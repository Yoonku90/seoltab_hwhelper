/**
 * 점수 향상 로드맵 데이터
 * 
 * 이 파일은 학습 활동과 점수 향상의 상관관계를 정의합니다.
 * 초기에는 교육 전문가 추정치를 사용하며, 실제 연구 데이터가 축적되면 점진적으로 교체됩니다.
 */

export type Subject = 'korean' | 'english' | 'math' | 'social' | 'science';
export type ActivityType = 
  | 'vocabulary_study'      // 어휘 학습 (영어, 국어)
  | 'problem_solve'         // 문제 풀이 (수학, 사회, 과학)
  | 'concept_mastery'       // 개념 마스터 (모든 과목)
  | 'reading_comprehension' // 독해 (국어, 영어)
  | 'grammar_learning'      // 문법 학습 (국어, 영어)
  | 'homework_consistency'; // 숙제 꾸준히 하기 (모든 과목)

export interface RoadmapItem {
  subject: Subject;
  activityType: ActivityType;
  targetCount: number; // 목표 개수 (단어 개수, 문제 개수, 개념 개수 등)
  estimatedScoreImprovement: number; // 예상 점수 상승 (0-100점 만점 기준)
  requiredTime: string; // 필요 시간 (예: "하루 30개 × 33일")
  source: 'research' | 'expert_estimate' | 'benchmark';
  sourceDescription: string; // 출처 설명
  confidence: 'high' | 'medium' | 'low';
  sampleSize?: number; // 표본 크기 (연구 데이터인 경우)
  correlation?: number; // 상관계수 (연구 데이터인 경우)
  effectSize?: number; // 효과 크기 (연구 데이터인 경우)
}

/**
 * 초기 로드맵 데이터 (교육 전문가 추정치 기반)
 * 
 * 참고:
 * - 이 데이터는 일반적인 교육 경험치를 기반으로 한 추정치입니다.
 * - 실제 연구 데이터가 축적되면 점진적으로 교체됩니다.
 * - 모든 수치는 0-100점 만점 기준입니다.
 */
export const ROADMAP_DATA: RoadmapItem[] = [
  // ==================== 영어 (English) ====================
  {
    subject: 'english',
    activityType: 'vocabulary_study',
    targetCount: 300,
    estimatedScoreImprovement: 3,
    requiredTime: '하루 20개 × 15일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'vocabulary_study',
    targetCount: 500,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 25개 × 20일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'vocabulary_study',
    targetCount: 1000,
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30개 × 33일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 영단어 학습은 영어 점수 향상에 가장 효과적',
    confidence: 'high'
  },
  {
    subject: 'english',
    activityType: 'vocabulary_study',
    targetCount: 2000,
    estimatedScoreImprovement: 18,
    requiredTime: '하루 40개 × 50일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'grammar_learning',
    targetCount: 5,
    estimatedScoreImprovement: 6,
    requiredTime: '주 1개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'reading_comprehension',
    targetCount: 30,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 1개 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'reading_comprehension',
    targetCount: 50,
    estimatedScoreImprovement: 8,
    requiredTime: '하루 1개 × 50일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'english',
    activityType: 'homework_consistency',
    targetCount: 30, // 30일
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30분 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 꾸준한 학습이 가장 중요',
    confidence: 'high'
  },

  // ==================== 수학 (Math) ====================
  {
    subject: 'math',
    activityType: 'problem_solve',
    targetCount: 30,
    estimatedScoreImprovement: 3,
    requiredTime: '하루 2개 × 15일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'math',
    activityType: 'problem_solve',
    targetCount: 50,
    estimatedScoreImprovement: 4,
    requiredTime: '하루 3개 × 17일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'math',
    activityType: 'problem_solve',
    targetCount: 100,
    estimatedScoreImprovement: 8,
    requiredTime: '하루 5개 × 20일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 문제 풀이는 수학 점수 향상의 핵심',
    confidence: 'high'
  },
  {
    subject: 'math',
    activityType: 'problem_solve',
    targetCount: 200,
    estimatedScoreImprovement: 15,
    requiredTime: '하루 7개 × 29일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'math',
    activityType: 'concept_mastery',
    targetCount: 5,
    estimatedScoreImprovement: 5,
    requiredTime: '주 1개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'math',
    activityType: 'concept_mastery',
    targetCount: 10,
    estimatedScoreImprovement: 8,
    requiredTime: '주 2개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'math',
    activityType: 'homework_consistency',
    targetCount: 30, // 30일
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30분 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 꾸준한 학습이 가장 중요',
    confidence: 'high'
  },

  // ==================== 국어 (Korean) ====================
  {
    subject: 'korean',
    activityType: 'vocabulary_study',
    targetCount: 300,
    estimatedScoreImprovement: 3,
    requiredTime: '하루 20개 × 15일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'korean',
    activityType: 'vocabulary_study',
    targetCount: 500,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 25개 × 20일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'korean',
    activityType: 'grammar_learning',
    targetCount: 5,
    estimatedScoreImprovement: 6,
    requiredTime: '주 1개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 문법 개념 마스터는 국어 점수 향상에 중요',
    confidence: 'high'
  },
  {
    subject: 'korean',
    activityType: 'grammar_learning',
    targetCount: 10,
    estimatedScoreImprovement: 10,
    requiredTime: '주 2개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'korean',
    activityType: 'reading_comprehension',
    targetCount: 30,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 1개 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'korean',
    activityType: 'reading_comprehension',
    targetCount: 50,
    estimatedScoreImprovement: 7,
    requiredTime: '하루 1개 × 50일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 독해력 향상은 국어 점수 향상의 핵심',
    confidence: 'high'
  },
  {
    subject: 'korean',
    activityType: 'homework_consistency',
    targetCount: 30, // 30일
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30분 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 꾸준한 학습이 가장 중요',
    confidence: 'high'
  },

  // ==================== 사회 (Social Studies) ====================
  {
    subject: 'social',
    activityType: 'concept_mastery',
    targetCount: 5,
    estimatedScoreImprovement: 4,
    requiredTime: '주 1개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'social',
    activityType: 'concept_mastery',
    targetCount: 10,
    estimatedScoreImprovement: 7,
    requiredTime: '주 2개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 핵심 개념 마스터는 사회 점수 향상에 중요',
    confidence: 'high'
  },
  {
    subject: 'social',
    activityType: 'problem_solve',
    targetCount: 50,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 2개 × 25일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'social',
    activityType: 'problem_solve',
    targetCount: 80,
    estimatedScoreImprovement: 8,
    requiredTime: '하루 3개 × 27일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'social',
    activityType: 'homework_consistency',
    targetCount: 30, // 30일
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30분 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 꾸준한 학습이 가장 중요',
    confidence: 'high'
  },

  // ==================== 과학 (Science) ====================
  {
    subject: 'science',
    activityType: 'concept_mastery',
    targetCount: 5,
    estimatedScoreImprovement: 4,
    requiredTime: '주 1개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'science',
    activityType: 'concept_mastery',
    targetCount: 8,
    estimatedScoreImprovement: 7,
    requiredTime: '주 1.5개 × 5주',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 핵심 개념 마스터는 과학 점수 향상에 중요',
    confidence: 'high'
  },
  {
    subject: 'science',
    activityType: 'problem_solve',
    targetCount: 50,
    estimatedScoreImprovement: 5,
    requiredTime: '하루 2개 × 25일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'science',
    activityType: 'problem_solve',
    targetCount: 90,
    estimatedScoreImprovement: 9,
    requiredTime: '하루 3개 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치)',
    confidence: 'medium'
  },
  {
    subject: 'science',
    activityType: 'homework_consistency',
    targetCount: 30, // 30일
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30분 × 30일',
    source: 'expert_estimate',
    sourceDescription: '교육 전문가 추정치 (일반적인 교육 경험치) - 꾸준한 학습이 가장 중요',
    confidence: 'high'
  },
];

/**
 * 과목별 로드맵 아이템 조회
 */
export function getRoadmapItems(subject: Subject): RoadmapItem[] {
  return ROADMAP_DATA.filter(item => item.subject === subject);
}

/**
 * 점수 향상 목표에 맞는 로드맵 아이템 조회
 * 
 * @param subject 과목
 * @param targetScoreImprovement 목표 점수 향상 (예: 10점)
 * @returns 목표 달성에 적합한 로드맵 아이템들 (점수 향상이 목표에 가장 가까운 순서)
 */
export function getRoadmapItemsForTarget(
  subject: Subject,
  targetScoreImprovement: number
): RoadmapItem[] {
  const items = getRoadmapItems(subject);
  
  // 목표 점수 향상에 가장 가까운 순서로 정렬
  return items
    .map(item => ({
      ...item,
      diff: Math.abs(item.estimatedScoreImprovement - targetScoreImprovement)
    }))
    .sort((a, b) => a.diff - b.diff)
    .map(({ diff, ...item }) => item);
}

/**
 * 활동 유형별 로드맵 아이템 조회
 */
export function getRoadmapItemsByActivity(
  subject: Subject,
  activityType: ActivityType
): RoadmapItem[] {
  return ROADMAP_DATA.filter(
    item => item.subject === subject && item.activityType === activityType
  );
}

/**
 * 로드맵 아이템의 활동 이름 (한글)
 */
export function getActivityName(activityType: ActivityType): string {
  const names: Record<ActivityType, string> = {
    vocabulary_study: '어휘 학습',
    problem_solve: '문제 풀기',
    concept_mastery: '개념 마스터',
    reading_comprehension: '독해 연습',
    grammar_learning: '문법 학습',
    homework_consistency: '숙제 꾸준히 하기'
  };
  return names[activityType] || activityType;
}

/**
 * 과목 이름 (한글)
 */
export function getSubjectName(subject: Subject): string {
  const names: Record<Subject, string> = {
    korean: '국어',
    english: '영어',
    math: '수학',
    social: '사회',
    science: '과학'
  };
  return names[subject] || subject;
}

