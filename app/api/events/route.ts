import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { LearningEvent } from '@/lib/types';

// POST /api/events - 학습 이벤트 로깅 (멈춤 감지 + AI Agent 메모리용)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      studentId,
      problemId,
      assignmentId,
      reviewProgramId,
      eventType,
      metadata,
    } = body;

    if (!studentId || !eventType) {
      return NextResponse.json(
        { error: 'studentId와 eventType이 필요합니다.' },
        { status: 400 }
      );
    }

    const event: LearningEvent = {
      studentId,
      problemId: problemId || undefined,
      assignmentId: assignmentId || undefined,
      reviewProgramId: reviewProgramId || undefined,
      eventType,
      metadata: metadata || {},
      timestamp: new Date(),
    };

    const events = await Collections.learningEvents();
    await events.insertOne(event);

    // 멈춤 감지 로직: 문제별로 stuck_score 계산
    if (problemId && ['idle_tick', 'edit_burst', 'focus_lost', 'app_background'].includes(eventType)) {
      await calculateStuckScore(problemId, studentId);
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('이벤트 로깅 오류:', error);
    return NextResponse.json(
      { error: '이벤트를 기록하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 멈춤 점수 계산 및 개입 트리거
async function calculateStuckScore(problemId: string, studentId: string) {
  try {
    const events = await Collections.learningEvents();
    const problems = await Collections.problems();
    const aiTutorSessions = await Collections.aiTutorSessions();

    // 최근 5분간의 이벤트 조회
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = await events
      .find({
        problemId,
        studentId,
        timestamp: { $gte: fiveMinutesAgo },
        eventType: {
          $in: ['idle_tick', 'edit_burst', 'focus_lost', 'app_background', 'hint_open', 'work_input'],
        },
      } as any)
      .sort({ timestamp: -1 })
      .toArray();

    // stuck_score 계산 (ChatGPT 대화 기준)
    let stuckScore = 0;

    for (const event of recentEvents) {
      if (event.eventType === 'idle_tick' && event.metadata?.idleTime) {
        const idleMs = event.metadata.idleTime;
        if (idleMs >= 75000) stuckScore = Math.max(stuckScore, 40); // 75초 이상 → 40점
        else if (idleMs >= 45000) stuckScore = Math.max(stuckScore, 25); // 45초 이상 → 25점
      } else if (event.eventType === 'edit_burst') {
        const editCount = event.metadata?.editCount || 0;
        if (editCount >= 6) stuckScore += 20;
      } else if (event.eventType === 'focus_lost') {
        stuckScore += 15;
      } else if (event.eventType === 'app_background' && event.metadata?.duration) {
        const duration = event.metadata.duration;
        if (duration >= 20000) stuckScore += 15; // 20초 이상 이탈
      } else if (event.eventType === 'hint_open') {
        // 힌트를 봤는데도 진전 없으면 추가 점수
        const hintLevel = event.metadata?.hintLevel || 1;
        if (hintLevel >= 2) stuckScore += 20;
        else stuckScore += 15;
      } else if (event.eventType === 'work_input') {
        // 입력이 있으면 점수 감소 (진전 중)
        stuckScore = Math.max(0, stuckScore - 10);
      }
    }

    // 개입이 필요한지 확인
    const existingSession = await aiTutorSessions.findOne({
      problemId,
      studentId,
    });

    const interventionCount = existingSession?.interventionCount || 0;

    // 개입 조건
    if (stuckScore >= 40 && interventionCount < 2) {
      // 1차 개입 (가벼운 체크인)
      if (!existingSession || interventionCount === 0) {
        await triggerIntervention(problemId, studentId, 'check_in', stuckScore);
      }
      // 2차 개입 (절반 성공 미션)
      else if (stuckScore >= 65 && interventionCount === 1) {
        await triggerIntervention(problemId, studentId, 'half_mission', stuckScore);
      }
      // 탈출구
      else if (stuckScore >= 85 && interventionCount >= 2) {
        await triggerIntervention(problemId, studentId, 'escape_route', stuckScore);
      }
    }
  } catch (error) {
    console.error('멈춤 점수 계산 오류:', error);
  }
}

// 개입 트리거
async function triggerIntervention(
  problemId: string,
  studentId: string,
  interventionType: 'check_in' | 'half_mission' | 'escape_route',
  stuckScore: number
) {
  try {
    const problems = await Collections.problems();
    const aiTutorSessions = await Collections.aiTutorSessions();
    const problem = await problems.findOne({ _id: problemId as any });

    if (!problem) return;

    const assignmentId = problem.assignmentId;

    // 기존 세션 확인 또는 생성
    let session = await aiTutorSessions.findOne({
      problemId,
      studentId,
    } as any);

    const now = new Date();
    const interventionCount = (session?.interventionCount || 0) + 1;

    if (!session) {
      const newSession = {
        problemId,
        assignmentId,
        studentId,
        sessionType: 'understanding_recovery' as const,
        understandingState: 'checking' as const,
        stuckScore,
        interventionCount: 1,
        lastInterventionAt: now,
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      await aiTutorSessions.insertOne(newSession as any);
    } else {
      await aiTutorSessions.updateOne(
        { _id: session._id } as any,
        {
          $set: {
            stuckScore,
            interventionCount,
            lastInterventionAt: now,
            understandingState: interventionType === 'escape_route' ? 'stuck' : 'checking',
            updatedAt: now,
          } as any,
        }
      );
    }

    // TODO: 실제 AI 개입 메시지 생성은 별도 API에서 처리
    // 여기서는 이벤트만 트리거
  } catch (error) {
    console.error('개입 트리거 오류:', error);
  }
}
