import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/assignments/:id/digest - Digest 조회
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

    const teacherDigests = await Collections.teacher_digests();
    const digest = await teacherDigests.findOne({ assignmentId });

    if (!digest) {
      return NextResponse.json(
        { error: 'Digest를 찾을 수 없습니다. 먼저 생성해주세요.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ digest });
  } catch (error) {
    console.error('Digest 조회 오류:', error);
    return NextResponse.json(
      { error: 'Digest를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

