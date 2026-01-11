// ==========================================
// 🧠 Agent Memory Updater
// 학습 이벤트를 분석하여 agentMemory 업데이트
// ==========================================

import { Collections } from '@/lib/db';
import { LearningEvent, Student } from '@/lib/types';

/**
 * 학습 이벤트를 분석하여 agentMemory 업데이트
 */
export async function updateAgentMemoryFromEvents(studentId: string): Promise<void> {
  try {
    const eventsCol = await Collections.learningEvents();
    const studentsCol = await Collections.students();
    
    // 학생 정보 조회
    const student = await studentsCol.findOne({ studentId });
    if (!student) {
      console.warn(`[memory/updater] Student not found: ${studentId}`);
      return;
    }
    
    // 최근 30일간의 이벤트 조회
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEvents = await eventsCol
      .find({
        studentId,
        timestamp: { $gte: thirtyDaysAgo },
      } as any)
      .sort({ timestamp: -1 })
      .toArray();
    
    if (recentEvents.length === 0) {
      // 이벤트가 없으면 agentMemory는 기본값 유지
      return;
    }
    
    // 1. 최근 학습 주제 추출 (concept_learned, quiz_completed 이벤트)
    const recentTopics = extractRecentTopics(recentEvents);
    
    // 2. 자주 틀리는 유형 계산 (problem_failed, quiz_incorrect 이벤트)
    const frequentMistakes = extractFrequentMistakes(recentEvents);
    
    // 3. 강점 영역 계산 (problem_solved, quiz_correct 이벤트)
    const strengths = extractStrengths(recentEvents);
    
    // 4. 평균 점수 계산 (score가 있는 이벤트)
    const averageScore = calculateAverageScore(recentEvents);
    
    // 5. 총 세션 수 계산 (session_start 이벤트)
    const totalSessions = countTotalSessions(recentEvents);
    
    // 6. 마지막 세션 시간 (session_start 이벤트의 최근 시간)
    const lastSessionAt = getLastSessionTime(recentEvents);
    
    // agentMemory 업데이트
    const updates: any = {
      'agentMemory.recentTopics': recentTopics,
      'agentMemory.frequentMistakes': frequentMistakes,
      'agentMemory.strengths': strengths,
      'agentMemory.averageScore': averageScore,
      'agentMemory.totalSessions': totalSessions,
      'agentMemory.lastSessionAt': lastSessionAt,
      updatedAt: new Date(),
    };
    
    await studentsCol.updateOne(
      { studentId },
      { $set: updates }
    );
    
    console.log(`[memory/updater] Updated agentMemory for student: ${studentId}`);
  } catch (error) {
    console.error('[memory/updater] Error updating agentMemory:', error);
    throw error;
  }
}

/**
 * 최근 학습 주제 추출
 */
function extractRecentTopics(events: LearningEvent[]): string[] {
  const topics = new Set<string>();
  
  for (const event of events) {
    if (event.eventType === 'concept_learned' || event.eventType === 'quiz_completed') {
      const topic = event.metadata?.topic || event.metadata?.keyPoint;
      if (topic) {
        topics.add(topic);
      }
    }
  }
  
  // 최대 10개만 반환 (최신순)
  return Array.from(topics).slice(0, 10);
}

/**
 * 자주 틀리는 유형 계산
 */
function extractFrequentMistakes(events: LearningEvent[]): string[] {
  const mistakeCounts = new Map<string, number>();
  
  for (const event of events) {
    if (event.eventType === 'problem_failed' || event.eventType === 'quiz_incorrect') {
      const mistakeType = event.metadata?.mistakeType || event.metadata?.topic;
      if (mistakeType) {
        mistakeCounts.set(mistakeType, (mistakeCounts.get(mistakeType) || 0) + 1);
      }
    }
  }
  
  // 3회 이상 틀린 유형만 선택
  const frequentMistakes = Array.from(mistakeCounts.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]) // 빈도순 정렬
    .map(([mistakeType, _]) => mistakeType)
    .slice(0, 20); // 최대 20개
  
  return frequentMistakes;
}

/**
 * 강점 영역 계산 (정답률 높은 주제)
 */
function extractStrengths(events: LearningEvent[]): string[] {
  const topicStats = new Map<string, { correct: number; total: number }>();
  
  for (const event of events) {
    const topic = event.metadata?.topic || event.metadata?.keyPoint;
    if (!topic) continue;
    
    if (!topicStats.has(topic)) {
      topicStats.set(topic, { correct: 0, total: 0 });
    }
    
    const stats = topicStats.get(topic)!;
    stats.total++;
    
    if (event.eventType === 'problem_solved' || event.eventType === 'quiz_correct') {
      stats.correct++;
    }
  }
  
  // 정답률 80% 이상인 주제만 선택
  const strengths = Array.from(topicStats.entries())
    .filter(([_, stats]) => stats.total >= 3 && (stats.correct / stats.total) >= 0.8)
    .sort((a, b) => {
      const ratioA = a[1].correct / a[1].total;
      const ratioB = b[1].correct / b[1].total;
      return ratioB - ratioA; // 정답률순 정렬
    })
    .map(([topic, _]) => topic)
    .slice(0, 10); // 최대 10개
  
  return strengths;
}

/**
 * 평균 점수 계산
 */
function calculateAverageScore(events: LearningEvent[]): number | undefined {
  const scores: number[] = [];
  
  for (const event of events) {
    if (event.metadata?.score !== undefined) {
      scores.push(event.metadata.score);
    }
  }
  
  if (scores.length === 0) {
    return undefined;
  }
  
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

/**
 * 총 세션 수 계산
 */
function countTotalSessions(events: LearningEvent[]): number {
  return events.filter(event => event.eventType === 'session_start').length;
}

/**
 * 마지막 세션 시간 가져오기
 */
function getLastSessionTime(events: LearningEvent[]): Date | undefined {
  const sessionStarts = events
    .filter(event => event.eventType === 'session_start')
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  
  if (sessionStarts.length === 0) {
    return undefined;
  }
  
  return sessionStarts[0].timestamp;
}

