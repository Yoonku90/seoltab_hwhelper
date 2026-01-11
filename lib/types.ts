// ==========================================
// 🤖 AI 에이전트 시스템 타입
// ==========================================

// 학생 프로필 (AI 에이전트가 학생을 기억)
export interface Student {
  _id?: string;
  studentId: string; // 고유 ID
  name: string; // 학생 이름 (예: "민서")
  nickname?: string; // 별명 (예: "민서야", "민서쌤")
  grade: '중1' | '중2' | '중3' | '고1' | '고2' | '고3';
  school?: string; // 학교명
  preferredSubjects?: string[]; // 좋아하는 과목
  weakSubjects?: string[]; // 취약 과목
  learningStyle?: 'visual' | 'auditory' | 'reading' | 'kinesthetic'; // 학습 스타일
  // 학습 이력 요약 (에이전트 메모리)
  agentMemory?: {
    recentTopics: string[]; // 최근 배운 주제
    frequentMistakes: string[]; // 자주 틀리는 유형
    strengths: string[]; // 잘하는 영역
    lastSessionAt?: Date;
    totalSessions?: number;
    averageScore?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

// 이미지 분석 우선순위 마커 (별표, 체크, 밑줄 등)
export interface PriorityMarker {
  type: 'star' | 'check' | 'underline' | 'circle' | 'highlight' | 'question_mark' | 'x_mark';
  problemNumber?: number;
  confidence: number; // 0-1 인식 신뢰도
  position?: { x: number; y: number; width: number; height: number };
  priority: 'high' | 'medium' | 'low'; // 우선순위
}

// AI 에이전트 액션 (선제적 행동)
export interface AgentAction {
  type: 
    | 'suggest_problem' // "이 문제 먼저 풀어볼까?"
    | 'explain_concept' // "이 개념 설명해줄게"
    | 'check_understanding' // "이해됐어?"
    | 'give_hint' // "힌트 줄게"
    | 'celebrate' // "잘했어!"
    | 'encourage' // "힘내!"
    | 'suggest_break' // "잠깐 쉴까?"
    | 'review_mistakes'; // "틀린 문제 다시 볼까?"
  targetProblemId?: string;
  reason: string; // 왜 이 행동을 하는지
  message: string; // 학생에게 보여줄 메시지
  priority: number; // 행동 우선순위 (높을수록 먼저)
}

// AI 에이전트 상태
export interface AgentState {
  currentAction?: AgentAction;
  pendingActions: AgentAction[];
  studentMood?: 'focused' | 'confused' | 'tired' | 'excited' | 'frustrated';
  sessionGoal?: string;
  progressPercent: number;
}

// ==========================================
// 기존 타입
// ==========================================

// 문제 상태 타입
export type ProblemStatus = 'solved' | 'stuck' | 'question' | 'not_started';

// 학습 세션 타입
export type SessionType = 'homework' | 'practice' | 'review' | 'consultation' | 'performance_task';

// 막힘 지점 타입
export type StuckPoint = 'concept' | 'condition' | 'equation' | 'calculation' | 'next_step' | 'motivation';

// 이해 회복 상태
export type UnderstandingState = 'stuck' | 'checking' | 'half_success' | 'recovering' | 'completed';

// 과제 상태
export interface Assignment {
  _id?: string;
  studentId: string;
  teacherId: string;
  title: string;
  description?: string;
  subject?: string; // 수학, 영어, 국어 등
  dueAt: Date;
  createdAt: Date;
  updatedAt: Date;
  progress: {
    total: number;
    solved: number;
    stuck: number;
    question: number;
    not_started: number;
  };
  lastActivityAt?: Date;
  top5Confirmed: boolean;
  top5ConfirmedAt?: Date;
  sessionType?: SessionType;
  isReviewProgram?: boolean; // 복습 프로그램 여부
  relatedSessionId?: string; // 연관된 과외 세션 ID
}

// 페이지 (교재 페이지 이미지)
export interface Page {
  _id?: string;
  assignmentId: string;
  pageNumber: number;
  imageUrl: string;
  uploadedAt: Date;
}

// 문제 (문항)
export interface Problem {
  _id?: string;
  assignmentId: string;
  pageId?: string;
  problemNumber: number;
  problemText?: string;
  imageUrl?: string;
  subject?: string; // 과목
  difficulty?: number; // 난이도 1-5
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  // 최신 상태 (빠른 조회용)
  latestAttempt: {
    status: ProblemStatus;
    updatedAt: Date;
    timeSpent?: number; // 초 단위
    stuckPoint?: StuckPoint; // 막힘 지점
    understandingScore?: number; // 이해도 점수 0-10
  };
  // 체크포인트 단계 (조건정리, 식세우기, 계산, 검산)
  checkpoints?: {
    condition?: { completed: boolean; completedAt?: Date };
    equation?: { completed: boolean; completedAt?: Date };
    calculation?: { completed: boolean; completedAt?: Date };
    verification?: { completed: boolean; completedAt?: Date };
  };
  createdAt: Date;
  updatedAt: Date;
}

// 시도 로그 (히스토리)
export interface Attempt {
  _id?: string;
  problemId: string;
  assignmentId: string;
  studentId: string;
  status: ProblemStatus;
  timeSpent?: number; // 초 단위
  createdAt: Date;
}

// AI 도움 세션 (기존 4단계 힌트)
export interface HelpSession {
  _id?: string;
  problemId: string;
  assignmentId: string;
  studentId: string;
  step: 1 | 2 | 3 | 4;
  problemText?: string;
  imageUrl?: string;
  hintTitle: string;
  hintText: string;
  nextAction?: string;
  createdAt: Date;
}

// AI 튜터 세션 (이해 회복 엔진)
export interface AITutorSession {
  _id?: string;
  problemId: string;
  assignmentId: string;
  studentId: string;
  sessionType: 'understanding_recovery' | 'half_success_mission' | 'follow_up';
  understandingState: UnderstandingState;
  stuckPoint?: StuckPoint;
  stuckScore?: number; // 멈춤 점수 0-100
  interventionCount?: number; // 개입 횟수
  lastInterventionAt?: Date;
  // 절반 성공 미션
  halfSuccessMission?: {
    type: 'condition' | 'equation' | 'calculation';
    template: string;
    completed: boolean;
    completedAt?: Date;
  };
  // 대화 히스토리
  messages?: TutorMessage[];
  createdAt: Date;
  updatedAt: Date;
}

// 튜터 메시지
export interface TutorMessage {
  role: 'ai' | 'student';
  content: string;
  timestamp: Date;
  actionType?: 'check_in' | 'half_mission' | 'encouragement' | 'escape_route';
}

// 선생님 Digest (Top5 + 요약)
export interface TeacherDigest {
  _id?: string;
  assignmentId: string;
  studentId: string;
  top5Problems: {
    problemId: string;
    problemNumber: number;
    problemText?: string;
    imageUrl?: string;
    stuckReason?: string;
    timeSpent?: number;
  }[];
  summary: {
    totalProblems: number;
    solved: number;
    stuck: number;
    question: number;
    commonStuckReasons: string[];
    averageTimeSpent?: number;
  };
  generatedAt: Date;
}

// 이미지 업로드 및 분석
export interface ImageUpload {
  _id?: string;
  studentId: string;
  assignmentId?: string;
  imageUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  analyzed: boolean;
  analyzedAt?: Date;
  // ☁️ 클라우드 스토리지 정보
  storageType?: 'local' | 'supabase';
  storagePath?: string; // Supabase 경로 (삭제 시 사용)
  // OCR 및 문제 인식 결과
  analysis?: {
    extractedText?: string;
    recognizedProblems?: {
      number: number;
      text?: string;
      position?: { x: number; y: number; width: number; height: number };
    }[];
    subject?: string;
    pageNumber?: number;
  };
}

// 학습 이벤트 로그 (멈춤 감지 + AI Agent 메모리용)
export interface LearningEvent {
  _id?: string;
  studentId: string;
  problemId?: string;
  assignmentId?: string;
  reviewProgramId?: string; // 복습 프로그램 ID
  eventType: 
    | 'session_start'      // 세션 시작
    | 'session_end'        // 세션 종료
    | 'problem_open'       // 문제 열기
    | 'problem_close'      // 문제 닫기
    | 'problem_solved'     // 문제 해결 (AI Agent)
    | 'problem_failed'     // 문제 실패 (AI Agent)
    | 'concept_learned'    // 개념 학습 (AI Agent)
    | 'quiz_completed'     // 퀴즈 완료 (AI Agent)
    | 'quiz_correct'       // 퀴즈 정답 (AI Agent)
    | 'quiz_incorrect'     // 퀴즈 오답 (AI Agent)
    | 'work_input'         // 작업 입력
    | 'idle_tick'          // 유휴 시간
    | 'edit_burst'         // 편집 폭주
    | 'focus_lost'         // 포커스 손실
    | 'app_background'     // 앱 백그라운드
    | 'checkpoint_select'  // 체크포인트 선택
    | 'hint_open'          // 힌트 열기
    | 'answer_reveal'      // 정답 공개
    | 'stuck_intervention' // 막힘 개입
    | 'half_mission_complete'; // 절반 성공 미션 완료
  metadata?: {
    // 기본 메타데이터
    duration?: number; // ms
    idleTime?: number; // ms
    editCount?: number;
    deleteCount?: number;
    checkpoint?: string;
    hintLevel?: number;
    stuckScore?: number;
    // AI Agent 메타데이터
    subject?: string;      // 과목 (수학, 영어, 국어 등)
    topic?: string;        // 주제 (이차방정식, 감각동사 등)
    difficulty?: number;   // 난이도 (1-5)
    timeSpent?: number;    // 소요 시간 (초)
    score?: number;        // 점수 (0-100)
    mistakeType?: string;  // 실수 유형
    keyPoint?: string;     // 핵심 포인트
    questionType?: string; // 문제 유형
    answer?: string;       // 학생 답변
    correctAnswer?: string; // 정답
  };
  timestamp: Date;
}

// 학습 고민 상담
export interface LearningConsultation {
  _id?: string;
  studentId: string;
  topic: string; // 고민 주제
  messages: ConsultationMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolved?: boolean;
}

export interface ConsultationMessage {
  role: 'student' | 'ai_tutor';
  content: string;
  timestamp: Date;
}

// 수행평가 도움
export interface PerformanceTask {
  _id?: string;
  studentId: string;
  teacherId?: string;
  title: string;
  description?: string;
  subject?: string;
  dueAt: Date;
  createdAt: Date;
  updatedAt: Date;
  // 수행평가 특화 필드
  taskType?: 'essay' | 'presentation' | 'project' | 'report';
  aiHelp?: {
    brainstorming?: string[];
    structure?: string[];
    feedback?: string;
    lastHelpAt?: Date;
  };
  progress?: {
    stage: 'planning' | 'drafting' | 'revising' | 'completing';
    completionPercent: number;
  };
}

// 복습 프로그램
export interface ReviewProgram {
  _id?: string;
  studentId: string;
  teacherId?: string;
  tutor?: 'rangsam' | 'joonssam'; // 선생님 선택 (기본: rangsam)
  originalSessionId: string; // 원본 과외 세션 ID
  title: string;
  durationMinutes?: 10 | 30 | 60 | 120;
  mode?: 'problem_set' | 'concept';
  intent?: 'review' | 'homework';
  source?: {
    subject?: string;
    imageUrl?: string;
    extractedText?: string;
    recognizedProblems?: { number: number; text?: string }[];
    grade?: string; // 예: 중1/중2/중3/고1/고2/고3
  };
  createdAt: Date;
  startAt: Date; // 복습 시작 시간 (과외 후)
  completedAt?: Date;
  // 복습 내용 (AI가 과외 내용 기반 자동 생성)
  reviewContent: {
    keyPoints: string[]; // 핵심 정리
    practiceProblems: {
      problemId?: string;
      problemText?: string;
      imageUrl?: string;
      relatedToOriginal?: string; // 원본 문제와의 연관성
    }[];
    quiz?: {
      question: string;
      answer: string;
    }[];
  };
  progress: {
    completed: boolean;
    completedItems: number;
    totalItems: number;
    lastActivityAt?: Date;
  };
}

