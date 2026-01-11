// ==========================================
// 🧠 Agent Memory Processor (Fallback Logic)
// 학습 데이터를 agentMemory로 변환 + Fallback 로직
// ==========================================

import { Collections } from '@/lib/db';
import { Student } from '@/lib/types';
import { 
  DEFAULT_RULES, 
  getDefaultDifficulty, 
  getDefaultLearningPath,
  getRecommendedStudyTime,
  getReviewCycle,
  Grade,
  Subject,
  LearningStyle
} from '@/lib/agent/fallback/default-rules';

/**
 * 데이터 상태 타입
 */
export type DataStatus = 'none' | 'low' | 'medium' | 'high';

/**
 * 전략 타입 (rule/hybrid/data)
 */
export type Strategy = 'rule' | 'hybrid' | 'data';

/**
 * 메모리 상태 인터페이스
 */
export interface MemoryState {
  studentId: string;
  dataStatus: DataStatus;
  sessionCount: number;
  grade: Grade;
}

/**
 * 데이터 상태에 따른 전략 선택
 */
export function getStrategy(sessionCount: number): Strategy {
  if (sessionCount === 0) {
    return 'rule';      // 데이터 없음 → 규칙 100%
  }
  if (sessionCount < 5) {
    return 'hybrid';    // 데이터 조금 (1-4 sessions) → 규칙 70% + 데이터 30%
  }
  if (sessionCount < 20) {
    return 'hybrid';    // 데이터 중간 (5-19 sessions) → 규칙 50% + 데이터 50%
  }
  return 'data';        // 데이터 많음 (20+ sessions) → 데이터 100%
}

/**
 * 데이터 상태 판단
 */
export function getDataStatus(sessionCount: number): DataStatus {
  if (sessionCount === 0) return 'none';
  if (sessionCount < 5) return 'low';
  if (sessionCount < 20) return 'medium';
  return 'high';
}

/**
 * 메모리 상태 가져오기
 */
export async function getMemoryState(studentId: string): Promise<MemoryState | null> {
  try {
    const col = await Collections.students();
    const student = await col.findOne({ studentId });
    
    if (!student) {
      return null;
    }
    
    const sessionCount = student.agentMemory?.totalSessions || 0;
    const grade = (student.grade || '중1') as Grade;
    const dataStatus = getDataStatus(sessionCount);
    
    return {
      studentId,
      dataStatus,
      sessionCount,
      grade,
    };
  } catch (error) {
    console.error('[memory/processor] Error getting memory state:', error);
    return null;
  }
}

/**
 * 난이도 추천 (Fallback Logic 적용)
 */
export async function getRecommendedDifficulty(
  studentId: string,
  grade: Grade,
  topic: string,
  subject?: Subject
): Promise<number> {
  try {
    const state = await getMemoryState(studentId);
    
    if (!state) {
      // 학생 데이터가 없으면 기본 규칙 사용
      return getDefaultDifficulty(grade);
    }
    
    const strategy = getStrategy(state.sessionCount);
    
    switch (strategy) {
      case 'rule':
        // 데이터 없으면 기본 규칙
        return getDefaultDifficulty(state.grade);
        
      case 'hybrid':
        // 규칙 + 데이터 혼합
        const ruleBased = getDefaultDifficulty(state.grade);
        const dataBased = await calculateDifficultyFromData(studentId, topic, subject);
        const ratio = state.sessionCount < 5 ? 0.7 : 0.5; // 조금: 70% 규칙, 중간: 50% 규칙
        return ruleBased * ratio + dataBased * (1 - ratio);
        
      case 'data':
        // 데이터 기반
        return await calculateDifficultyFromData(studentId, topic, subject);
    }
  } catch (error) {
    console.error('[memory/processor] Error getting recommended difficulty:', error);
    // 에러 시 기본 규칙 반환
    return getDefaultDifficulty(grade);
  }
}

/**
 * 학습 경로 추천 (Fallback Logic 적용)
 */
export async function getRecommendedLearningPath(
  studentId: string,
  grade: Grade,
  subject: Subject
): Promise<string[]> {
  try {
    const state = await getMemoryState(studentId);
    
    if (!state) {
      // 학생 데이터가 없으면 기본 규칙 사용
      return getDefaultLearningPath(subject);
    }
    
    const strategy = getStrategy(state.sessionCount);
    
    switch (strategy) {
      case 'rule':
        // 데이터 없으면 기본 경로
        return getDefaultLearningPath(subject);
        
      case 'hybrid':
        // 규칙 + 데이터 혼합 (기본 경로 우선, 데이터로 보완)
        const defaultPath = getDefaultLearningPath(subject);
        const dataPath = await calculateLearningPathFromData(studentId, subject);
        // 기본 경로를 우선하되, 데이터 경로의 일부를 반영
        return [...defaultPath, ...dataPath.slice(0, 2)];
        
      case 'data':
        // 데이터 기반 (나중에 구현)
        const optimizedPath = await calculateLearningPathFromData(studentId, subject);
        return optimizedPath.length > 0 ? optimizedPath : getDefaultLearningPath(subject);
    }
  } catch (error) {
    console.error('[memory/processor] Error getting recommended learning path:', error);
    // 에러 시 기본 경로 반환
    return getDefaultLearningPath(subject);
  }
}

/**
 * 추천 학습 시간 (Fallback Logic 적용)
 */
export async function getRecommendedStudyTimeForStudent(
  studentId: string,
  grade: Grade
): Promise<number> {
  try {
    const state = await getMemoryState(studentId);
    
    if (!state) {
      // 학생 데이터가 없으면 기본 규칙 사용
      return getRecommendedStudyTime(grade);
    }
    
    // 현재는 기본 규칙 사용 (나중에 데이터 기반으로 개선 가능)
    return getRecommendedStudyTime(state.grade);
  } catch (error) {
    console.error('[memory/processor] Error getting recommended study time:', error);
    return getRecommendedStudyTime(grade);
  }
}

/**
 * 데이터로부터 난이도 계산 (데이터 있을 때)
 */
async function calculateDifficultyFromData(
  studentId: string,
  topic: string,
  subject?: Subject
): Promise<number> {
  try {
    const col = await Collections.students();
    const student = await col.findOne({ studentId });
    
    if (!student || !student.agentMemory) {
      // 데이터 없으면 기본값
      return 3;
    }
    
    const { averageScore, frequentMistakes, strengths } = student.agentMemory;
    
    // 기본 난이도 3 (중간)
    let difficulty = 3;
    
    // 평균 점수 기반 조정 (점수가 높으면 난이도 ↑)
    if (averageScore !== undefined) {
      if (averageScore >= 80) difficulty += 0.5;      // 잘함 → 난이도 ↑
      else if (averageScore >= 60) difficulty += 0;   // 보통 → 유지
      else difficulty -= 0.5;                         // 어려움 → 난이도 ↓
    }
    
    // 자주 틀리는 유형이 있으면 난이도 ↓ (기초부터)
    if (frequentMistakes && frequentMistakes.length > 0) {
      difficulty -= 0.3;
    }
    
    // 잘하는 영역이 있으면 난이도 ↑
    if (strengths && strengths.length > 0) {
      difficulty += 0.2;
    }
    
    // 1-5 범위로 제한
    return Math.max(1, Math.min(5, difficulty));
  } catch (error) {
    console.error('[memory/processor] Error calculating difficulty from data:', error);
    return 3;
  }
}

/**
 * 데이터로부터 학습 경로 계산 (데이터 있을 때)
 */
async function calculateLearningPathFromData(
  studentId: string,
  subject: Subject
): Promise<string[]> {
  try {
    const col = await Collections.students();
    const student = await col.findOne({ studentId });
    
    if (!student || !student.agentMemory) {
      // 데이터 없으면 빈 배열 (기본 경로 사용)
      return [];
    }
    
    const { recentTopics, frequentMistakes } = student.agentMemory;
    
    // 최근 학습 주제 기반 경로 추천
    const path: string[] = [];
    
    // 최근 배운 주제 복습
    if (recentTopics && recentTopics.length > 0) {
      path.push(`${recentTopics[0]} 복습`);
    }
    
    // 자주 틀리는 유형 보완
    if (frequentMistakes && frequentMistakes.length > 0) {
      path.push(`${frequentMistakes[0]} 보완`);
    }
    
    return path;
  } catch (error) {
    console.error('[memory/processor] Error calculating learning path from data:', error);
    return [];
  }
}

