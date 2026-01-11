import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import type { Assignment, Problem, ProblemStatus } from '@/lib/types';

// POST /api/sessions/from-image
// 이미지 분석 결과(analysis)를 기반으로 과제 + 문제들을 생성하고 assignmentId를 반환
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, teacherId, analysis, imageUrl } = body as {
      studentId?: string;
      teacherId?: string;
      analysis?: any;
      imageUrl?: string;
    };

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    if (!analysis || !Array.isArray(analysis.recognizedProblems)) {
      return NextResponse.json(
        { error: 'analysis.recognizedProblems가 필요합니다.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 기본: 7일 뒤
    const subject = analysis.subject || '미분류';
    const pageNumber = analysis.pageNumber ? `p.${analysis.pageNumber}` : '';
    const title = `${subject} ${pageNumber}`.trim() || '새 학습 세션';

    const assignments = await Collections.assignments();
    const problemsCol = await Collections.problems();

    const assignment: Assignment = {
      studentId,
      teacherId: teacherId || 'teacher1',
      title,
      description: '이미지 업로드로 생성된 세션',
      subject,
      dueAt,
      createdAt: now,
      updatedAt: now,
      progress: {
        total: 0,
        solved: 0,
        stuck: 0,
        question: 0,
        not_started: 0,
      },
      top5Confirmed: false,
      sessionType: 'homework',
    };

    const insertResult = await assignments.insertOne(assignment as any);
    const assignmentId = insertResult.insertedId.toString();

    // 문제 생성
    const recognized: any[] = analysis.recognizedProblems;
    const docs: Omit<Problem, '_id'>[] = recognized
      .filter((p) => typeof p?.number === 'number')
      .map((p, idx) => {
        const status: ProblemStatus = 'not_started';
        return {
          assignmentId,
          problemNumber: p.number ?? idx + 1,
          problemText: p.text || undefined,
          // 업로드한 원본 페이지 이미지를 문제에도 연결 (문제별 크롭은 추후)
          imageUrl: imageUrl || undefined,
          subject,
          position: p.position
            ? {
                x: p.position.x,
                y: p.position.y,
                width: p.position.width,
                height: p.position.height,
              }
            : undefined,
          latestAttempt: {
            status,
            updatedAt: now,
          },
          createdAt: now,
          updatedAt: now,
        };
      });

    if (docs.length > 0) {
      await problemsCol.insertMany(docs as any[]);
    }

    // progress 업데이트
    await assignments.updateOne(
      { _id: insertResult.insertedId } as any,
      {
        $set: {
          'progress.total': docs.length,
          'progress.not_started': docs.length,
          lastActivityAt: now,
          updatedAt: now,
        } as any,
      }
    );

    return NextResponse.json({ success: true, assignmentId });
  } catch (error) {
    console.error('세션 생성 오류:', error);
    return NextResponse.json(
      { error: '세션을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


