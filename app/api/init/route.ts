// GET /api/init - 인덱스 생성 (개발용)
import { NextResponse } from 'next/server';
import { createIndexes } from '@/lib/db';

export async function GET() {
  try {
    await createIndexes();
    return NextResponse.json({ success: true, message: '인덱스가 생성되었습니다.' });
  } catch (error) {
    console.error('인덱스 생성 오류:', error);
    return NextResponse.json(
      { error: '인덱스 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

