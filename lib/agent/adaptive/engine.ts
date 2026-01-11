// ==========================================
// 🎯 Adaptive Engine (적응형 학습 엔진)
// 개인화된 학습 경로 및 난이도 조절
// ==========================================

import { Collections } from '@/lib/db';
import { LearningEvent, Student } from '@/lib/types';
import { getDefaultDifficulty, Grade, Subject } from '@/lib/agent/fallback/default-rules';
import { getRecommendedDifficulty } from '@/lib/agent/memory/processor';

/**
 * 적응형 학습 계획
 */
export interface AdaptiveLearningPlan {
  studentId: string;
  currentLevel: Record<string, number>; // 과목별 현재 수준
  learningPath: Array<{
    subject: string;
    topic: string;
    difficulty: number;
    masteryScore: number; // 0-1
    nextRecommended?: string;
  }>;
  pace: 'slow' | 'normal' | 'fast';
}

/**
 * 적응형 학습 계획 생성
 */
export async function generateAdaptivePlan(
  studentId: string,
  grade: Grade,
  subject: Subject
): Promise<AdaptiveLearningPlan> {
  try {
    const studentsCol = await Collections.students();
    const student = await studentsCol.findOne({ studentId });
    
    if (!student) {
      throw new Error(`Student not found: ${studentId}`);
    }
    
    // 현재 수준 계산
    const currentLevel = await calculateCurrentLevel(studentId);
    
    // 학습 경로 생성
    const learningPath = await generateLearningPath(studentId, grade, subject);
    
    // 학습 속도 결정
    const pace = determinePace(student);
    
    return {
      studentId,
      currentLevel,
      learningPath,
      pace,
    };
  } catch (error) {
    console.error('[adaptive/engine] Error generating plan:', error);
    throw error;
  }
}

/**
 * 현재 수준 계산
 */
async function calculateCurrentLevel(studentId: string): Promise<Record<string, number>> {
  const eventsCol = await Collections.learningEvents();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const events = await eventsCol
    .find({
      studentId,
      timestamp: { $gte: thirtyDaysAgo },
    } as any)
    .toArray();
  
  const subjectStats = new Map<string, { correct: number; total: number }>();
  
  for (const event of events) {
    const subject = event.metadata?.subject || 'unknown';
    if (!subjectStats.has(subject)) {
      subjectStats.set(subject, { correct: 0, total: 0 });
    }
    
    const stats = subjectStats.get(subject)!;
    stats.total++;
    
    if (event.eventType === 'problem_solved' || event.eventType === 'quiz_correct') {
      stats.correct++;
    }
  }
  
  const currentLevel: Record<string, number> = {};
  
  for (const [subject, stats] of subjectStats.entries()) {
    if (stats.total > 0) {
      currentLevel[subject] = (stats.correct / stats.total) * 5; // 0-5 스케일
    }
  }
  
  return currentLevel;
}

/**
 * 학습 경로 생성
 */
async function generateLearningPath(
  studentId: string,
  grade: Grade,
  subject: Subject
): Promise<Array<{ subject: string; topic: string; difficulty: number; masteryScore: number; nextRecommended?: string }>> {
  const path: Array<{ subject: string; topic: string; difficulty: number; masteryScore: number; nextRecommended?: string }> = [];
  
  // 기본 난이도로 시작
  const baseDifficulty = await getRecommendedDifficulty(studentId, grade, '', subject);
  
  // 예시 주제들 (나중에 동적으로 생성 가능)
  const topics = ['기초 개념', '예제 풀이', '문제 연습', '응용 문제'];
  
  for (let i = 0; i < topics.length; i++) {
    const difficulty = baseDifficulty + (i * 0.5);
    path.push({
      subject,
      topic: topics[i],
      difficulty: Math.min(5, Math.max(1, difficulty)),
      masteryScore: 0.5, // 기본값 (나중에 계산)
      nextRecommended: i < topics.length - 1 ? topics[i + 1] : undefined,
    });
  }
  
  return path;
}

/**
 * 학습 속도 결정
 */
function determinePace(student: Student): 'slow' | 'normal' | 'fast' {
  const sessionCount = student.agentMemory?.totalSessions || 0;
  const averageScore = student.agentMemory?.averageScore || 0;
  
  if (sessionCount < 5) {
    return 'normal'; // 데이터 부족
  }
  
  if (averageScore >= 80) {
    return 'fast'; // 잘하는 학생
  } else if (averageScore >= 60) {
    return 'normal';
  } else {
    return 'slow'; // 기초가 필요한 학생
  }
}

/**
 * 난이도 조절
 */
export async function adjustDifficulty(
  studentId: string,
  grade: Grade,
  topic: string,
  subject: Subject,
  currentDifficulty: number,
  isCorrect: boolean
): Promise<number> {
  if (isCorrect) {
    // 정답이면 난이도 약간 증가
    return Math.min(5, currentDifficulty + 0.2);
  } else {
    // 오답이면 난이도 약간 감소
    return Math.max(1, currentDifficulty - 0.3);
  }
}

