import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // 각 컬렉션 카운트
    const [students, reviewPrograms, imageUploads, accessTokens] = await Promise.all([
      db.collection('students').countDocuments(),
      db.collection('review_programs').countDocuments(),
      db.collection('image_uploads').countDocuments(),
      db.collection('access_tokens').countDocuments({ expiresAt: { $gt: new Date() } }),
    ]);

    return NextResponse.json({
      students,
      reviewPrograms,
      imageUploads,
      accessTokens,
    });
  } catch (error) {
    console.error('[admin/stats] Error:', error);
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 });
  }
}

