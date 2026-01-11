import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { Assignment } from '@/lib/types';

// GET /api/assignments?studentId=xxx - 학생의 과제 리스트
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }

    const assignments = await Collections.assignments();
    const list = await assignments
      .find({ studentId })
      .sort({ dueAt: 1 })
      .toArray();

    return NextResponse.json({ assignments: list });
  } catch (error) {
    console.error('과제 리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '과제 리스트를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/assignments - 새 과제 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, teacherId, title, description, dueAt } = body;

    if (!studentId || !teacherId || !title || !dueAt) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const assignments = await Collections.assignments();
    const now = new Date();

    const assignment: Assignment = {
      studentId,
      teacherId,
      title,
      description,
      dueAt: new Date(dueAt),
      createdAt: now,
      updatedAt: now,
      progress: {
        total: 0,
        solved: 0,
        stuck: 0,
        question: 0,
      },
      top5Confirmed: false,
    };

    const result = await assignments.insertOne(assignment);

    return NextResponse.json({
      assignment: { ...assignment, _id: result.insertedId.toString() },
    });
  } catch (error) {
    console.error('과제 생성 오류:', error);
    return NextResponse.json(
      { error: '과제를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

