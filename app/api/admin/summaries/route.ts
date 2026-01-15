import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

/**
 * GET /api/admin/summaries
 * 관리자용 요약본 목록 조회 (시크릿 노트만)
 */
export async function GET(req: NextRequest) {
  try {
    const reviewPrograms = await Collections.reviewPrograms();
    
    // 시크릿 노트만 필터링 (metadata.isSecretNote === true)
    const summaries = await reviewPrograms
      .find({ 'metadata.isSecretNote': true } as any)
      .sort({ createdAt: -1 } as any)
      .limit(100) // 최대 100개
      .toArray();

    return NextResponse.json({
      success: true,
      summaries: summaries.map((s: any) => ({
        _id: s._id.toString(),
        title: s.title || '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]',
        studentId: s.studentId || 'unknown',
        studentName: s.studentName || null,
        studentNickname: s.studentNickname || null,
        subject: s.subject || null,
        createdAt: s.createdAt || s.startAt || new Date(),
        metadata: s.metadata || {},
      })),
    });
  } catch (error) {
    console.error('[admin/summaries] 오류:', error);
    return NextResponse.json(
      { error: '요약본 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

