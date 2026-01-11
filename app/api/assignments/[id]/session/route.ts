import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/assignments/:id/session - 과제 세션 조회 (문제 리스트 + 최신 상태)
export async function GET(
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

    const problems = await Collections.problems();
    const problemList = await problems
      .find({ assignmentId })
      .sort({ problemNumber: 1 })
      .toArray();

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

    return NextResponse.json({
      assignment: {
        _id: assignment._id?.toString(),
        title: assignment.title,
        description: assignment.description,
        dueAt: assignment.dueAt,
        progress: assignment.progress,
        lastActivityAt: assignment.lastActivityAt,
        top5Confirmed: assignment.top5Confirmed,
      },
      problems: problemList.map((p) => ({
        _id: p._id?.toString(),
        problemNumber: p.problemNumber,
        problemText: p.problemText,
        imageUrl: p.imageUrl,
        position: p.position,
        latestAttempt: p.latestAttempt,
      })),
    });
  } catch (error) {
    console.error('세션 조회 오류:', error);
    return NextResponse.json(
      { error: '세션을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

