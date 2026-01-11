// ==========================================
// 📊 Event Tracker (학습 이벤트 자동 수집)
// Review Program에서 학습 이벤트를 자동으로 수집
// ==========================================

/**
 * 학습 이벤트 수집 헬퍼 함수
 */
export async function trackLearningEvent(
  studentId: string,
  reviewProgramId: string,
  eventType: 
    | 'session_start'
    | 'session_end'
    | 'concept_learned'
    | 'quiz_completed'
    | 'quiz_correct'
    | 'quiz_incorrect',
  metadata?: {
    subject?: string;
    topic?: string;
    difficulty?: number;
    timeSpent?: number;
    score?: number;
    keyPoint?: string;
    questionType?: string;
    answer?: string;
    correctAnswer?: string;
  }
) {
  try {
    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        reviewProgramId,
        eventType,
        metadata: metadata || {},
      }),
    });

    if (!response.ok) {
      console.error('[Event Tracker] 이벤트 수집 실패:', await response.text());
    }
  } catch (error) {
    console.error('[Event Tracker] 이벤트 수집 오류:', error);
    // 에러가 나도 앱은 계속 작동하도록 (non-blocking)
  }
}

/**
 * 세션 시작 이벤트
 */
export function trackSessionStart(studentId: string, reviewProgramId: string, subject?: string) {
  return trackLearningEvent(studentId, reviewProgramId, 'session_start', {
    subject,
  });
}

/**
 * 세션 종료 이벤트
 */
export function trackSessionEnd(
  studentId: string,
  reviewProgramId: string,
  timeSpent?: number
) {
  return trackLearningEvent(studentId, reviewProgramId, 'session_end', {
    timeSpent,
  });
}

/**
 * 개념 학습 이벤트
 */
export function trackConceptLearned(
  studentId: string,
  reviewProgramId: string,
  topic: string,
  metadata?: {
    subject?: string;
    difficulty?: number;
    timeSpent?: number;
    keyPoint?: string;
  }
) {
  return trackLearningEvent(studentId, reviewProgramId, 'concept_learned', {
    topic,
    ...metadata,
  });
}

/**
 * 퀴즈 정답 이벤트
 */
export function trackQuizCorrect(
  studentId: string,
  reviewProgramId: string,
  metadata?: {
    subject?: string;
    topic?: string;
    difficulty?: number;
    timeSpent?: number;
    score?: number;
    keyPoint?: string;
  }
) {
  return trackLearningEvent(studentId, reviewProgramId, 'quiz_correct', {
    score: 100,
    ...metadata,
  });
}

/**
 * 퀴즈 오답 이벤트
 */
export function trackQuizIncorrect(
  studentId: string,
  reviewProgramId: string,
  metadata?: {
    subject?: string;
    topic?: string;
    difficulty?: number;
    timeSpent?: number;
    answer?: string;
    correctAnswer?: string;
    keyPoint?: string;
  }
) {
  return trackLearningEvent(studentId, reviewProgramId, 'quiz_incorrect', {
    score: 0,
    ...metadata,
  });
}

/**
 * 퀴즈 완료 이벤트
 */
export function trackQuizCompleted(
  studentId: string,
  reviewProgramId: string,
  metadata?: {
    subject?: string;
    topic?: string;
    difficulty?: number;
    timeSpent?: number;
    score?: number;
  }
) {
  return trackLearningEvent(studentId, reviewProgramId, 'quiz_completed', metadata);
}

