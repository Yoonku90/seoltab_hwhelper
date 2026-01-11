import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

// GET /api/review-programs?studentId=xxx - 복습 프로그램 리스트
export async function GET(req: NextRequest) {
  try {
    const studentId = req.nextUrl.searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.reviewPrograms();
    const list = await col
      .find({ studentId } as any)
      .sort({ createdAt: -1 } as any)
      .limit(50)
      .toArray();

    return NextResponse.json({ success: true, reviewPrograms: list });
  } catch (error) {
    console.error('복습 프로그램 리스트 오류:', error);
    return NextResponse.json(
      { error: '복습 프로그램을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


