import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { collectionName, confirm } = body;

    if (confirm !== 'DELETE') {
      return NextResponse.json({ error: '확인 문구가 필요합니다.' }, { status: 400 });
    }

    if (!collectionName) {
      return NextResponse.json({ error: 'collectionName이 필요합니다.' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection(collectionName).deleteMany({});

    return NextResponse.json({
      success: true,
      message: `✅ ${collectionName}에서 ${result.deletedCount}개 삭제됨`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[admin/clear-collection] Error:', error);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}

