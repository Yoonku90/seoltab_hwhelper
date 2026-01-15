import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

/**
 * 테스트 데이터 정리 API
 * 
 * POST /api/admin/clear-data
 * Body: { confirm: "DELETE_ALL_DATA" }
 * 
 * ⚠️ 주의: 모든 데이터가 삭제됩니다!
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 안전장치: confirm 필드 확인
    if (body.confirm !== 'DELETE_ALL_DATA') {
      return NextResponse.json(
        { 
          error: '삭제를 확인하려면 confirm: "DELETE_ALL_DATA"를 보내주세요.',
          warning: '⚠️ 이 작업은 모든 데이터를 삭제합니다!'
        }, 
        { status: 400 }
      );
    }
    
    const results: Record<string, number> = {};
    
    // 학생 데이터 삭제
    const studentsCol = await Collections.students();
    const studentsResult = await studentsCol.deleteMany({});
    results.students = studentsResult.deletedCount;
    
    // 복습 프로그램 삭제
    const rpCol = await Collections.reviewPrograms();
    const rpResult = await rpCol.deleteMany({});
    results.review_programs = rpResult.deletedCount;
    
    // 이미지 업로드 삭제
    const imagesCol = await Collections.imageUploads();
    const imagesResult = await imagesCol.deleteMany({});
    results.image_uploads = imagesResult.deletedCount;
    
    // 과제 삭제
    const assignmentsCol = await Collections.assignments();
    const assignmentsResult = await assignmentsCol.deleteMany({});
    results.assignments = assignmentsResult.deletedCount;
    
    // 문제 삭제
    const problemsCol = await Collections.problems();
    const problemsResult = await problemsCol.deleteMany({});
    results.problems = problemsResult.deletedCount;
    
    // 시도 기록 삭제
    const attemptsCol = await Collections.attempts();
    const attemptsResult = await attemptsCol.deleteMany({});
    results.attempts = attemptsResult.deletedCount;
    
    // 도움 세션 삭제
    const helpCol = await Collections.help_sessions();
    const helpResult = await helpCol.deleteMany({});
    results.help_sessions = helpResult.deletedCount;
    
    // AI 튜터 세션 삭제
    const tutorCol = await Collections.aiTutorSessions();
    const tutorResult = await tutorCol.deleteMany({});
    results.ai_tutor_sessions = tutorResult.deletedCount;
    
    // 학습 이벤트 삭제
    const eventsCol = await Collections.learningEvents();
    const eventsResult = await eventsCol.deleteMany({});
    results.learning_events = eventsResult.deletedCount;
    
    const totalDeleted = Object.values(results).reduce((sum, count) => sum + count, 0);
    
    return NextResponse.json({
      success: true,
      message: `✨ 총 ${totalDeleted}개의 데이터가 삭제되었습니다!`,
      details: results,
    });
    
  } catch (error) {
    console.error('[admin/clear-data] Error:', error);
    return NextResponse.json(
      { error: '데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET: 현재 데이터 현황 확인
export async function GET() {
  try {
    const counts: Record<string, number> = {};
    
    const studentsCol = await Collections.students();
    counts.students = await studentsCol.countDocuments();
    
    const rpCol = await Collections.reviewPrograms();
    counts.review_programs = await rpCol.countDocuments();
    
    const imagesCol = await Collections.imageUploads();
    counts.image_uploads = await imagesCol.countDocuments();
    
    const assignmentsCol = await Collections.assignments();
    counts.assignments = await assignmentsCol.countDocuments();
    
    const problemsCol = await Collections.problems();
    counts.problems = await problemsCol.countDocuments();
    
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    return NextResponse.json({
      message: '📊 현재 데이터 현황',
      total,
      details: counts,
    });
    
  } catch (error) {
    console.error('[admin/clear-data/GET] Error:', error);
    return NextResponse.json(
      { error: '데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


