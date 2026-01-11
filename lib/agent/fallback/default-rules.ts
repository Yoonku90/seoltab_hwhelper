// ==========================================
// 🎯 Default Rules 시스템 (Cold Start 지원)
// 데이터 없이도 작동하는 기본 규칙
// ==========================================

/**
 * 학년 타입 정의
 */
export type Grade = '초1' | '초2' | '초3' | '초4' | '초5' | '초6' | 
                    '중1' | '중2' | '중3' | 
                    '고1' | '고2' | '고3' | 
                    '일반인' | 'N수생';

/**
 * 과목 타입 정의
 */
export type Subject = '국어' | '영어' | '수학' | '사회' | '과학' | '기타';

/**
 * 학습 스타일 타입
 */
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'practice';

/**
 * 기본 규칙 인터페이스
 */
export interface DefaultRules {
  // 학년별 기본 난이도 (1-5 스케일)
  defaultDifficulty: Record<Grade, number>;
  
  // 과목별 기본 학습 경로
  defaultLearningPath: Record<Subject, string[]>;
  
  // 학년별 추천 학습 시간 (분)
  recommendedStudyTime: Record<Grade, number>;
  
  // 기본 학습 스타일
  defaultLearningStyle: LearningStyle;
  
  // 학년별 복습 주기 (일)
  reviewCycle: Record<Grade, number>;
  
  // 과목별 기본 학습 단계
  subjectLearningSteps: Record<Subject, string[]>;
}

/**
 * Default Rules 정의
 */
export const DEFAULT_RULES: DefaultRules = {
  // 학년별 기본 난이도 (1-5 스케일)
  defaultDifficulty: {
    '초1': 1,
    '초2': 1.5,
    '초3': 2,
    '초4': 2,
    '초5': 2.5,
    '초6': 2.5,
    '중1': 2,      // 기초 개념 위주
    '중2': 2.5,    // 기초 + 응용
    '중3': 3,      // 응용 문제
    '고1': 3,      // 중등 심화 + 고등 기초
    '고2': 3.5,    // 고등 핵심 개념
    '고3': 4,      // 수능 대비
    '일반인': 2.5,
    'N수생': 4.5,
  },
  
  // 과목별 기본 학습 경로
  defaultLearningPath: {
    '국어': ['개념 설명', '예시 제시', '문제 연습', '피드백'],
    '영어': ['문법 설명', '예문 제시', '문제 연습', '피드백'],
    '수학': ['기초 개념', '예제 풀이', '문제 연습', '피드백'],
    '사회': ['개념 설명', '사례 제시', '문제 연습', '피드백'],
    '과학': ['개념 설명', '실험/관찰', '문제 연습', '피드백'],
    '기타': ['개념 설명', '예시 제시', '문제 연습', '피드백'],
  },
  
  // 학년별 추천 학습 시간 (분)
  recommendedStudyTime: {
    '초1': 15,
    '초2': 20,
    '초3': 20,
    '초4': 25,
    '초5': 25,
    '초6': 30,
    '중1': 20,     // 20분
    '중2': 25,     // 25분
    '중3': 30,     // 30분
    '고1': 30,     // 30분
    '고2': 35,     // 35분
    '고3': 40,     // 40분
    '일반인': 30,
    'N수생': 45,
  },
  
  // 기본 학습 스타일
  defaultLearningStyle: 'practice',
  
  // 학년별 복습 주기 (일)
  reviewCycle: {
    '초1': 1,
    '초2': 1,
    '초3': 2,
    '초4': 2,
    '초5': 3,
    '초6': 3,
    '중1': 2,      // 2일마다 복습
    '중2': 3,      // 3일마다 복습
    '중3': 3,      // 3일마다 복습
    '고1': 3,      // 3일마다 복습
    '고2': 4,      // 4일마다 복습
    '고3': 5,      // 5일마다 복습 (수능 대비)
    '일반인': 3,
    'N수생': 2,    // N수생은 더 자주 복습
  },
  
  // 과목별 기본 학습 단계
  subjectLearningSteps: {
    '국어': ['문법/어휘', '읽기', '쓰기', '문학'],
    '영어': ['문법', '독해', '어휘', '작문'],
    '수학': ['개념 이해', '공식 익히기', '문제 풀이', '응용 문제'],
    '사회': ['개념 정리', '사례 분석', '문제 풀이', '논술형'],
    '과학': ['개념 이해', '실험/관찰', '문제 풀이', '탐구'],
    '기타': ['개념 설명', '예시 제시', '문제 연습', '피드백'],
  },
};

/**
 * 학년별 기본 난이도 가져오기
 */
export function getDefaultDifficulty(grade: Grade): number {
  return DEFAULT_RULES.defaultDifficulty[grade] || 3;
}

/**
 * 과목별 기본 학습 경로 가져오기
 */
export function getDefaultLearningPath(subject: Subject): string[] {
  return DEFAULT_RULES.defaultLearningPath[subject] || 
         DEFAULT_RULES.defaultLearningPath['기타'];
}

/**
 * 학년별 추천 학습 시간 가져오기
 */
export function getRecommendedStudyTime(grade: Grade): number {
  return DEFAULT_RULES.recommendedStudyTime[grade] || 30;
}

/**
 * 학년별 복습 주기 가져오기
 */
export function getReviewCycle(grade: Grade): number {
  return DEFAULT_RULES.reviewCycle[grade] || 3;
}

/**
 * 과목별 기본 학습 단계 가져오기
 */
export function getSubjectLearningSteps(subject: Subject): string[] {
  return DEFAULT_RULES.subjectLearningSteps[subject] || 
         DEFAULT_RULES.subjectLearningSteps['기타'];
}

/**
 * 기본 학습 스타일 가져오기
 */
export function getDefaultLearningStyle(): LearningStyle {
  return DEFAULT_RULES.defaultLearningStyle;
}

