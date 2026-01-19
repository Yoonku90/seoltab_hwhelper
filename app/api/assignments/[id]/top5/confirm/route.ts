import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// POST /api/assignments/:id/top5/confirm - Top5 질문 확정
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const body = await req.json();
    const { problemIds, studentId } = body;

    if (!ObjectId.isValid(assignmentId)) {
      return NextResponse.json(
        { error: '유효하지 않은 과제 ID입니다.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(problemIds) || problemIds.length === 0) {
      return NextResponse.json(
        { error: '질문할 문제 ID 배열이 필요합니다.' },
        { status: 400 }
      );
    }

    if (problemIds.length > 5) {
      return NextResponse.json(
        { error: '최대 5개까지만 선택할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 문제들이 해당 과제에 속하는지 확인
    const problems = await Collections.problems();
    const problemList = await problems
      .find({
        _id: { $in: problemIds.map((id: string) => new ObjectId(id)) },
        assignmentId,
      })
      .toArray();

    if (problemList.length !== problemIds.length) {
      return NextResponse.json(
        { error: '일부 문제를 찾을 수 없거나 해당 과제에 속하지 않습니다.' },
        { status: 400 }
      );
    }

    // 선택된 문제들의 상태를 'question'으로 업데이트
    const now = new Date();
    for (const problem of problemList) {
      await problems.updateOne(
        { _id: problem._id },
        {
          $set: {
            'latestAttempt.status': 'question',
            'latestAttempt.updatedAt': now,
            updatedAt: now,
          },
        }
      );

      // 시도 로그 생성
      if (studentId) {
        const attempts = await Collections.attempts();
        await attempts.insertOne({
          problemId: problem._id?.toString() || '',
          assignmentId,
          studentId,
          status: 'question',
          createdAt: now,
        });
      }
    }

    // 과제에 Top5 확정 표시
    const assignments = await Collections.assignments();
    await assignments.updateOne(
      { _id: new ObjectId(assignmentId) },
      {
        $set: {
          top5Confirmed: true,
          top5ConfirmedAt: now,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({ success: true, confirmedCount: problemIds.length });
  } catch (error) {
    console.error('Top5 확정 오류:', error);
    return NextResponse.json(
      { error: 'Top5를 확정하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

