import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const { studentId } = await params;
    const db = await getDb();

    // 학생 정보
    const student = await db.collection('students').findOne({ studentId });

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 복습 프로그램 목록
    const reviewPrograms = await db.collection('review_programs')
      .find({ studentId })
      .sort({ createdAt: -1 })
      .project({ title: 1, subject: 1, createdAt: 1, progress: 1 })
      .toArray();

    // 이미지 업로드 목록
    const imageUploads = await db.collection('image_uploads')
      .find({ studentId })
      .sort({ uploadedAt: -1 })
      .project({ fileName: 1, uploadedAt: 1, analyzed: 1 })
      .toArray();

    return NextResponse.json({
      student,
      reviewPrograms,
      imageUploads,
    });
  } catch (error) {
    console.error('[admin/students/[studentId]] Error:', error);
    return NextResponse.json({ error: '학생 상세 조회 실패' }, { status: 500 });
  }
}

