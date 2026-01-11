// ==========================================
// 🧠 Agent Memory Update API
// 학습 이벤트를 분석하여 agentMemory 업데이트
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { updateAgentMemoryFromEvents } from '@/lib/agent/memory/updater';

/**
 * POST /api/agent/memory/update
 * 특정 학생의 agentMemory 업데이트
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId } = body;
    
    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }
    
    await updateAgentMemoryFromEvents(studentId);
    
    return NextResponse.json({ 
      success: true, 
      message: `agentMemory updated for student: ${studentId}` 
    });
  } catch (error) {
    console.error('[agent/memory/update] Error:', error);
    return NextResponse.json(
      { error: 'agentMemory 업데이트 실패' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent/memory/update/all
 * 모든 학생의 agentMemory 업데이트 (배치 처리용)
 */
export async function PUT(req: NextRequest) {
  try {
    const { Collections } = await import('@/lib/db');
    const studentsCol = await Collections.students();
    
    // 모든 학생 조회
    const students = await studentsCol.find({}).toArray();
    
    const results = {
      total: students.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };
    
    // 각 학생의 agentMemory 업데이트
    for (const student of students) {
      try {
        await updateAgentMemoryFromEvents(student.studentId);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`${student.studentId}: ${error.message}`);
        console.error(`[agent/memory/update/all] Error for ${student.studentId}:`, error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      results 
    });
  } catch (error) {
    console.error('[agent/memory/update/all] Error:', error);
    return NextResponse.json(
      { error: '배치 업데이트 실패' },
      { status: 500 }
    );
  }
}

