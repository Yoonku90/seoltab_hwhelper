import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

/**
 * GET /api/admin/summaries
 * 관리자용 요약본 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const reviewPrograms = await Collections.reviewPrograms();
    const searchParams = req.nextUrl.searchParams;
    const studentId = searchParams.get('studentId');
    const roomId = searchParams.get('roomId');
    const limit = Number(searchParams.get('limit') || 100);
    const offset = Number(searchParams.get('offset') || 0);

    const filter: Record<string, any> = {};
    if (studentId) {
      filter.studentId = studentId;
    }
    if (roomId) {
      filter['metadata.roomId'] = roomId;
    }

    const summaries = await reviewPrograms
      .find(filter as any)
      .sort({ _id: -1 } as any)
      .skip(offset)
      .limit(Number.isFinite(limit) ? limit : 100)
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

