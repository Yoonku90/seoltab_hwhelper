import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { ProblemStatus } from '@/lib/types';

// POST /api/problems/:id/status - 문제 상태 업데이트
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: problemId } = await params;
    const body = await req.json();
    const { status, studentId, timeSpent } = body;

    if (!ObjectId.isValid(problemId)) {
      return NextResponse.json(
        { error: '유효하지 않은 문제 ID입니다.' },
        { status: 400 }
      );
    }

    if (!status || !['solved', 'stuck', 'question'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }

    const problems = await Collections.problems();
    const problem = await problems.findOne({ _id: new ObjectId(problemId) } as any);

    if (!problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const now = new Date();

    // 문제의 최신 상태 업데이트
    await problems.updateOne(
      { _id: new ObjectId(problemId) } as any,
      {
        $set: {
          'latestAttempt.status': status as ProblemStatus,
          'latestAttempt.updatedAt': now,
          ...(timeSpent && { 'latestAttempt.timeSpent': timeSpent }),
          updatedAt: now,
        },
      }
    );

    // 시도 로그 생성
    const attempts = await Collections.attempts();
    await attempts.insertOne({
      problemId,
      assignmentId: problem.assignmentId,
      studentId,
      status: status as ProblemStatus,
      timeSpent,
      createdAt: now,
    });

    // 과제 진행률 업데이트
    const assignments = await Collections.assignments();
    const assignment = await assignments.findOne({
      _id: new ObjectId(problem.assignmentId),
    } as any);

    if (assignment) {
      // 이전 상태에서 카운트 감소
      const oldStatus = problem.latestAttempt.status;
      if (oldStatus === 'solved') {
        assignment.progress.solved = Math.max(0, assignment.progress.solved - 1);
      } else if (oldStatus === 'stuck') {
        assignment.progress.stuck = Math.max(0, assignment.progress.stuck - 1);
      } else if (oldStatus === 'question') {
        assignment.progress.question = Math.max(0, assignment.progress.question - 1);
      }

      // 새 상태로 카운트 증가
      if (status === 'solved') {
        assignment.progress.solved += 1;
      } else if (status === 'stuck') {
        assignment.progress.stuck += 1;
      } else if (status === 'question') {
        assignment.progress.question += 1;
      }

      await assignments.updateOne(
        { _id: new ObjectId(problem.assignmentId) } as any,
        {
          $set: {
            progress: assignment.progress,
            lastActivityAt: now,
            updatedAt: now,
          },
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('상태 업데이트 오류:', error);
    return NextResponse.json(
      { error: '상태를 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

