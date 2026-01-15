import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

/**
 * POST /api/learning/complete
 * 학습 완료 기록 (요약본 → 복습 → 숙제 플로우)
 * 
 * Body: {
 *   studentId: string,
 *   reviewProgramId: string,
 *   roomId?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, reviewProgramId, roomId } = body;

    if (!studentId || !reviewProgramId) {
      return NextResponse.json(
        { error: 'studentId와 reviewProgramId가 필요합니다.' },
        { status: 400 }
      );
    }

    const now = new Date();
    
    // 복습 일정 생성 (간격 반복)
    const reviewSchedule = [
      { date: new Date(now.getTime() + 24 * 60 * 60 * 1000), completed: false }, // 1일 후
      { date: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), completed: false }, // 3일 후
      { date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), completed: false }, // 7일 후
      { date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), completed: false }, // 14일 후
    ];

    // 학습 세션 저장
    const learningSessions = await Collections.learningSessions();
    await learningSessions.insertOne({
      studentId,
      reviewProgramId,
      roomId: roomId || null,
      completedAt: now,
      reviewSchedule,
      createdAt: now,
      updatedAt: now,
    } as any);

    return NextResponse.json({
      success: true,
      message: '학습 완료가 기록되었습니다.',
      nextReviewDate: reviewSchedule[0].date,
    });
  } catch (error) {
    console.error('[learning/complete] Error:', error);
    return NextResponse.json(
      { error: '학습 완료 기록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

