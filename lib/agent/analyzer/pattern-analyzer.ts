// ==========================================
// 🔍 Pattern Analyzer (패턴 분석 엔진)
// 학습 패턴 분석 및 추천 생성
// ==========================================

import { Collections } from '@/lib/db';
import { LearningEvent, Student } from '@/lib/types';

/**
 * 학습 패턴 분석 결과
 */
export interface PatternAnalysis {
  studentId: string;
  performanceTrend: 'improving' | 'stable' | 'declining';
  mistakePatterns: Array<{
    type: string;
    frequency: number;
    subjects: string[];
  }>;
  learningEfficiency: number; // 0-1 (학습 효율)
  recommendations: string[];
}

/**
 * 학습 패턴 분석
 */
export async function analyzeLearningPattern(studentId: string): Promise<PatternAnalysis> {
  try {
    const eventsCol = await Collections.learningEvents();
    
    // 최근 30일간의 이벤트 조회
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await eventsCol
      .find({
        studentId,
        timestamp: { $gte: thirtyDaysAgo },
      } as any)
      .sort({ timestamp: -1 })
      .toArray();
    
    // 성능 추세 분석
    const performanceTrend = analyzePerformanceTrend(events);
    
    // 실수 패턴 분석
    const mistakePatterns = analyzeMistakePatterns(events);
    
    // 학습 효율 계산
    const learningEfficiency = calculateLearningEfficiency(events);
    
    // 추천 생성
    const recommendations = generateRecommendations(performanceTrend, mistakePatterns, learningEfficiency);
    
    return {
      studentId,
      performanceTrend,
      mistakePatterns,
      learningEfficiency,
      recommendations,
    };
  } catch (error) {
    console.error('[pattern-analyzer] Error analyzing patterns:', error);
    throw error;
  }
}

/**
 * 성능 추세 분석
 */
function analyzePerformanceTrend(events: LearningEvent[]): 'improving' | 'stable' | 'declining' {
  const scores: number[] = [];
  
  for (const event of events) {
    if (event.metadata?.score !== undefined) {
      scores.push(event.metadata.score);
    }
  }
  
  if (scores.length < 3) {
    return 'stable';
  }
  
  // 최근 1주일 vs 이전 1주일 비교
  const recentScores = scores.slice(0, Math.floor(scores.length / 2));
  const olderScores = scores.slice(Math.floor(scores.length / 2));
  
  const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
  const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length;
  
  const diff = recentAvg - olderAvg;
  
  if (diff > 5) return 'improving';
  if (diff < -5) return 'declining';
  return 'stable';
}

/**
 * 실수 패턴 분석
 */
function analyzeMistakePatterns(events: LearningEvent[]): Array<{ type: string; frequency: number; subjects: string[] }> {
  const mistakeCounts = new Map<string, { count: number; subjects: Set<string> }>();
  
  for (const event of events) {
    if (event.eventType === 'problem_failed' || event.eventType === 'quiz_incorrect') {
      const mistakeType = event.metadata?.mistakeType || 'unknown';
      const subject = event.metadata?.subject || 'unknown';
      
      if (!mistakeCounts.has(mistakeType)) {
        mistakeCounts.set(mistakeType, { count: 0, subjects: new Set() });
      }
      
      const entry = mistakeCounts.get(mistakeType)!;
      entry.count++;
      entry.subjects.add(subject);
    }
  }
  
  return Array.from(mistakeCounts.entries())
    .map(([type, data]) => ({
      type,
      frequency: data.count,
      subjects: Array.from(data.subjects),
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
}

/**
 * 학습 효율 계산
 */
function calculateLearningEfficiency(events: LearningEvent[]): number {
  let totalTime = 0;
  let correctCount = 0;
  let totalCount = 0;
  
  for (const event of events) {
    if (event.metadata?.timeSpent) {
      totalTime += event.metadata.timeSpent;
    }
    
    if (event.eventType === 'problem_solved' || event.eventType === 'quiz_correct') {
      correctCount++;
      totalCount++;
    } else if (event.eventType === 'problem_failed' || event.eventType === 'quiz_incorrect') {
      totalCount++;
    }
  }
  
  if (totalCount === 0) return 0.5;
  
  const accuracy = correctCount / totalCount;
  const timeEfficiency = totalTime > 0 ? Math.min(1, 1000 / totalTime) : 0.5; // 시간이 적을수록 효율적
  
  return (accuracy * 0.7 + timeEfficiency * 0.3);
}

/**
 * 추천 생성
 */
function generateRecommendations(
  trend: 'improving' | 'stable' | 'declining',
  mistakes: Array<{ type: string; frequency: number; subjects: string[] }>,
  efficiency: number
): string[] {
  const recommendations: string[] = [];
  
  if (trend === 'declining') {
    recommendations.push('최근 성적이 하락하고 있어요. 기초 개념 복습을 추천합니다.');
  }
  
  if (mistakes.length > 0 && mistakes[0].frequency >= 5) {
    recommendations.push(`${mistakes[0].type} 관련 개념을 더 학습하는 것을 추천합니다.`);
  }
  
  if (efficiency < 0.5) {
    recommendations.push('학습 효율을 높이기 위해 집중 시간을 늘리는 것을 추천합니다.');
  }
  
  return recommendations;
}

