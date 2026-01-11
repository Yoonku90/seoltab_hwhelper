// ==========================================
// 🔮 Prediction Model (예측 모델)
// 통계 기반 성과 예측 및 약점 조기 감지
// ==========================================

import { Collections } from '@/lib/db';
import { LearningEvent, Student } from '@/lib/types';

/**
 * 예측 결과
 */
export interface Prediction {
  studentId: string;
  predictedScore: number; // 예상 점수 (0-100)
  confidence: number; // 신뢰도 (0-1)
  weakAreas: string[]; // 약점 영역
  recommendedActions: string[];
}

/**
 * 성과 예측
 */
export async function predictPerformance(
  studentId: string,
  subject?: string,
  topic?: string
): Promise<Prediction> {
  try {
    const eventsCol = await Collections.learningEvents();
    const studentsCol = await Collections.students();
    
    const student = await studentsCol.findOne({ studentId });
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }
    
    // 최근 30일간의 이벤트 조회
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await eventsCol
      .find({
        studentId,
        timestamp: { $gte: thirtyDaysAgo },
        ...(subject && { 'metadata.subject': subject }),
        ...(topic && { 'metadata.topic': topic }),
      } as any)
      .sort({ timestamp: -1 })
      .toArray();
    
    // 평균 점수 계산
    const scores: number[] = [];
    for (const event of events) {
      if (event.metadata?.score !== undefined) {
        scores.push(event.metadata.score);
      }
    }
    
    const averageScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : student.agentMemory?.averageScore || 70;
    
    // 추세 분석 (선형 추세)
    const trend = calculateTrend(scores);
    const predictedScore = averageScore + trend * 10; // 추세 적용
    
    // 약점 영역 식별
    const weakAreas = identifyWeakAreas(events);
    
    // 추천 액션 생성
    const recommendedActions = generateRecommendedActions(predictedScore, weakAreas);
    
    // 신뢰도 계산 (데이터가 많을수록 높음)
    const confidence = Math.min(1, scores.length / 20);
    
    return {
      studentId,
      predictedScore: Math.max(0, Math.min(100, predictedScore)),
      confidence,
      weakAreas,
      recommendedActions,
    };
  } catch (error) {
    console.error('[prediction/predictor] Error predicting performance:', error);
    throw error;
  }
}

/**
 * 추세 계산 (선형 회귀)
 */
function calculateTrend(scores: number[]): number {
  if (scores.length < 3) return 0;
  
  const n = scores.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = scores[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  return slope; // 양수면 상승, 음수면 하락
}

/**
 * 약점 영역 식별
 */
function identifyWeakAreas(events: LearningEvent[]): string[] {
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
  
  // 정답률 60% 미만인 주제 선택
  return Array.from(topicStats.entries())
    .filter(([_, stats]) => stats.total >= 3 && (stats.correct / stats.total) < 0.6)
    .map(([topic, _]) => topic)
    .slice(0, 5);
}

/**
 * 추천 액션 생성
 */
function generateRecommendedActions(predictedScore: number, weakAreas: string[]): string[] {
  const actions: string[] = [];
  
  if (predictedScore < 60) {
    actions.push('기초 개념 복습을 강력히 추천합니다.');
  }
  
  if (weakAreas.length > 0) {
    actions.push(`${weakAreas[0]} 관련 문제를 더 풀어보세요.`);
  }
  
  if (predictedScore >= 80) {
    actions.push('현재 수준이 좋습니다. 응용 문제에 도전해보세요.');
  }
  
  return actions;
}

/**
 * 약점 조기 감지
 */
export async function detectEarlyWeakness(studentId: string, subject: string): Promise<boolean> {
  try {
    const prediction = await predictPerformance(studentId, subject);
    return prediction.predictedScore < 60 || prediction.weakAreas.length >= 3;
  } catch (error) {
    console.error('[prediction/predictor] Error detecting weakness:', error);
    return false;
  }
}

