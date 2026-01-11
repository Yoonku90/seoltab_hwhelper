import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// POST /api/assignments/:id/digest/generate - Digest 생성
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignmentId = params.id;

    if (!ObjectId.isValid(assignmentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 과제 ID입니다.' },
        { status: 400 }
      );
    }

    const assignments = await Collections.assignments();
    const assignment = await assignments.findOne({
      _id: new ObjectId(assignmentId),
    });

    if (!assignment) {
      return NextResponse.json(
        { error: '과제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const problems = await Collections.problems();
    const problemList = await problems
      .find({ assignmentId })
      .sort({ problemNumber: 1 })
      .toArray();

    // Top5 문제 추천 (점수 기반)
    // stuck +5, question +4, 소요시간 상위 +1~3
    const problemScores = problemList.map((p) => {
      let score = 0;
      if (p.latestAttempt.status === 'stuck') score += 5;
      if (p.latestAttempt.status === 'question') score += 4;
      if (p.latestAttempt.timeSpent) {
        // 소요시간이 많을수록 점수 추가 (최대 3점)
        score += Math.min(3, Math.floor(p.latestAttempt.timeSpent / 60));
      }
      return { problem: p, score };
    });

    // 점수 순으로 정렬하고 상위 5개 선택
    const top5Problems = problemScores
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => ({
        problemId: item.problem._id?.toString() || '',
        problemNumber: item.problem.problemNumber,
        problemText: item.problem.problemText,
        imageUrl: item.problem.imageUrl,
        stuckReason: item.problem.latestAttempt.status === 'stuck' ? '막힘' : undefined,
        timeSpent: item.problem.latestAttempt.timeSpent,
      }));

    // 막힘 이유 수집
    const helpSessions = await Collections.help_sessions();
    const stuckProblems = problemList.filter(
      (p) => p.latestAttempt.status === 'stuck'
    );
    const commonStuckReasons: string[] = [];
    
    for (const problem of stuckProblems.slice(0, 10)) {
      const sessions = await helpSessions
        .find({ problemId: problem._id?.toString() })
        .sort({ step: 1 })
        .limit(1)
        .toArray();
      
      if (sessions.length > 0 && sessions[0].hintText) {
        // 힌트 텍스트에서 막힘 이유 추출 (간단히 첫 50자)
        const reason = sessions[0].hintText.substring(0, 50);
        if (reason && !commonStuckReasons.includes(reason)) {
          commonStuckReasons.push(reason);
        }
      }
    }

    // 평균 소요시간 계산
    const totalTime = problemList
      .map((p) => p.latestAttempt.timeSpent || 0)
      .reduce((sum, time) => sum + time, 0);
    const averageTimeSpent =
      problemList.length > 0 ? Math.floor(totalTime / problemList.length) : undefined;

    // Digest 생성
    const digest = {
      assignmentId,
      studentId: assignment.studentId,
      top5Problems,
      summary: {
        totalProblems: assignment.progress.total,
        solved: assignment.progress.solved,
        stuck: assignment.progress.stuck,
        question: assignment.progress.question,
        commonStuckReasons: commonStuckReasons.slice(0, 5),
        averageTimeSpent,
      },
      generatedAt: new Date(),
    };

    const teacherDigests = await Collections.teacher_digests();
    
    // 기존 digest가 있으면 업데이트, 없으면 생성
    const existingDigest = await teacherDigests.findOne({ assignmentId });
    
    if (existingDigest) {
      await teacherDigests.updateOne(
        { _id: existingDigest._id },
        { $set: digest }
      );
    } else {
      await teacherDigests.insertOne(digest);
    }

    return NextResponse.json({ digest });
  } catch (error) {
    console.error('Digest 생성 오류:', error);
    return NextResponse.json(
      { error: 'Digest를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

