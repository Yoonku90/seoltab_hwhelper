# AI Agent 기능 및 데이터 활용 가이드

## 🤖 AI Agent vs 단순 LLM

### 단순 LLM
- **역할**: 질문에 답변하는 도구
- **특징**: 매번 동일한 응답, 컨텍스트 없음
- **한계**: 학생별 맞춤 불가, 학습 이력 무시

### AI Agent (현재 시스템)
- **역할**: 학생을 기억하고 적응하는 선생님
- **특징**: 
  - 학생별 맞춤 학습
  - 학습 이력 추적 및 활용
  - 적응형 난이도 조절
  - 선제적 행동 (칭찬, 동기부여)
  - 지속적 학습 및 개선

## 📊 쌓는 데이터

### 1. Student Profile (학생 프로필)
```typescript
interface Student {
  studentId: string;        // 학생 고유 ID
  name: string;             // 이름
  nickname: string;         // 호칭 (예: "오웬아", "지니야")
  grade: '중1' | '중2' | ...; // 학년
  agentMemory?: {           // 🧠 AI Agent 메모리
    recentTopics: string[];      // 최근 배운 주제 (최대 10개)
    frequentMistakes: string[];  // 자주 틀리는 유형 (최대 20개)
    strengths: string[];         // 잘하는 영역 (최대 10개) ⭐ 칭찬에 활용
    totalSessions: number;       // 총 세션 수
    lastSessionAt?: Date;        // 마지막 세션 시간
    averageScore?: number;       // 평균 점수
  };
}
```

### 2. Learning Events (학습 이벤트)
```typescript
interface LearningEvent {
  studentId: string;
  reviewProgramId?: string;
  eventType: 
    | 'session_start'      // 세션 시작
    | 'session_end'        // 세션 종료
    | 'concept_learned'    // 개념 학습
    | 'quiz_correct'       // 퀴즈 정답 ⭐ strengths 계산에 활용
    | 'quiz_incorrect'     // 퀴즈 오답 ⭐ frequentMistakes 계산에 활용
    | 'problem_solved'     // 문제 해결
    | 'problem_failed'     // 문제 실패
    | 'idle_tick'          // 멈춤 감지
    | 'hint_open'          // 힌트 열기
    | ...;
  metadata: {
    subject?: string;      // 과목
    topic?: string;        // 주제
    keyPoint?: string;     // 핵심 포인트
    difficulty?: number;   // 난이도
    score?: number;        // 점수
    timeSpent?: number;    // 소요 시간
    answer?: string;       // 학생 답변
    correctAnswer?: string; // 정답
  };
  timestamp: Date;
}
```

## 🧠 데이터 활용 방식

### 1. Cold Start (데이터 없을 때)
```typescript
// Priority 0: 기본 규칙 기반
- strengths 데이터 없음 → 칭찬 없이 일반 인사로 시작
- totalSessions === 0 → 기본 난이도 사용
- 기본 학습 경로 제공
```

### 2. 데이터 축적 과정
```
1. 세션 시작 → session_start 이벤트
2. 개념 학습 → concept_learned 이벤트 (recentTopics 추가)
3. 문제 해결 → quiz_correct/incorrect 이벤트
4. 세션 종료 → session_end 이벤트
5. 자동 분석 → agentMemory 업데이트:
   - strengths: 정답률 80% 이상 주제
   - frequentMistakes: 자주 틀린 유형
   - recentTopics: 최근 배운 주제
   - averageScore: 평균 점수 계산
```

### 3. 데이터 활용 (우선순위별)

#### Priority 0: Cold Start (데이터 없음)
- **기본 규칙**: 학년별 기본 난이도, 기본 학습 경로
- **칭찬**: 일반적인 칭찬만 (강점 기반 칭찬 없음)
- **적용 시점**: totalSessions < 5

#### Priority 1: Data Collection (데이터 수집)
- **이벤트 수집**: 모든 학습 이벤트 자동 로깅
- **메모리 업데이트**: 세션 종료 시 자동 분석
- **적용 시점**: totalSessions >= 5

#### Priority 2: Pattern Analysis (패턴 분석)
- **강점 분석**: strengths 데이터 생성 (정답률 80% 이상)
- **약점 분석**: frequentMistakes 데이터 생성
- **활용**:
  - 세션 시작 시 칭찬 (strengths 활용) ⭐
  - 정답 피드백 시 강점 언급 (strengths 활용) ⭐
  - 약점 영역 집중 설명 (frequentMistakes 활용)

#### Priority 3: Adaptive Learning (적응형 학습)
- **난이도 조절**: 학생 실력에 맞는 난이도 자동 조절
- **학습 경로**: 약점 영역 우선 학습 경로 생성
- **속도 조절**: 학생 속도에 맞는 학습 속도 제안

#### Priority 4: Prediction & Intervention (예측 및 개입)
- **성과 예측**: 다음 시험 예상 점수
- **개입 시스템**: 학습 패턴 이상 감지 시 자동 개입
- **추천 액션**: 학습 전략 추천

## 🎯 현재 구현된 기능

### ✅ 구현 완료

1. **Data Collection (Priority 1)**
   - 학습 이벤트 자동 로깅
   - agentMemory 업데이트
   - strengths, frequentMistakes, recentTopics 계산

2. **Pattern Analysis (Priority 2)**
   - 강점 영역 계산 (정답률 80% 이상)
   - 약점 영역 계산 (자주 틀리는 유형)
   - 세션 시작 시 칭찬 (strengths 활용) ⭐
   - 정답 피드백 시 강점 언급 (strengths 활용) ⭐

3. **Cold Start (Priority 0)**
   - 기본 규칙 기반 학습
   - 데이터 없을 때 기본 난이도 사용

### 🔄 부분 구현

1. **Adaptive Learning (Priority 3)**
   - 난이도 조절 로직 (기본 구현)
   - 학습 경로 추천 (기본 구현)
   - 속도 조절 (기본 구현)

2. **Prediction & Intervention (Priority 4)**
   - 성과 예측 모델 (기본 구현)
   - 개입 시스템 (기본 구현)
   - 추천 액션 (기본 구현)

## 💡 칭찬 기능의 데이터 의존성

### 데이터 없을 때 (Cold Start)
```typescript
// Priority 1 (세션 시작 시 칭찬)
if (context.studentMemory?.strengths?.length > 0) {
  // strengths 데이터 있으면 → 칭찬 메시지 생성
} else {
  // 데이터 없으면 → 일반 인사만 (칭찬 없음)
}

// Priority 2 (강점 기반 칭찬)
if (context.studentMemory?.strengths?.length > 0 && 
    currentTopic in strengths) {
  // 해당 주제가 강점이면 → "역시 네 강점이지!" 칭찬
} else {
  // 데이터 없으면 → 일반 칭찬만
}
```

### 데이터 축적 과정
1. **첫 세션**: 데이터 없음 → 일반 칭찬만
2. **세션 진행**: quiz_correct/incorrect 이벤트 수집
3. **세션 종료**: agentMemory 자동 업데이트
4. **다음 세션**: strengths 데이터 활용 가능 → 맞춤 칭찬 ⭐

### 데이터 충분 기준
- **최소 데이터**: totalSessions >= 2, strengths.length >= 1
- **권장 데이터**: totalSessions >= 5, strengths.length >= 3
- **최적 데이터**: totalSessions >= 10, strengths.length >= 5

## 🚀 AI Agent의 고유 기능

### 1. 기억 (Memory)
- **학생별 데이터 저장**: strengths, frequentMistakes, recentTopics
- **학습 이력 추적**: 모든 학습 이벤트 로깅
- **장기 기억**: 30일간의 데이터 유지

### 2. 적응 (Adaptation)
- **난이도 조절**: 학생 실력에 맞는 난이도
- **학습 경로**: 약점 우선 학습 경로
- **속도 조절**: 학생 속도에 맞는 학습 속도

### 3. 예측 (Prediction)
- **성과 예측**: 다음 시험 예상 점수
- **패턴 분석**: 학습 패턴 이상 감지
- **추천 액션**: 학습 전략 추천

### 4. 선제적 행동 (Proactive Action)
- **칭찬**: 세션 시작 시 지난 수업 칭찬 (strengths 활용)
- **동기부여**: 강점 언급, 성취감 부여
- **개입**: 학습 패턴 이상 시 자동 개입

### 5. 지속적 개선 (Continuous Improvement)
- **자동 분석**: 세션 종료 시 자동 메모리 업데이트
- **패턴 학습**: 시간이 지날수록 더 정확한 분석
- **맞춤 강화**: 학생별 맞춤 학습 경험 제공

## 📈 데이터 활용 예시

### 예시 1: 세션 시작 시 칭찬
```typescript
// 학생 데이터
agentMemory: {
  strengths: ['감각동사', '수여동사', '4형식'],
  totalSessions: 8
}

// AI Agent 행동
"오웬아, 저번에 **감각동사** 엄청 잘했었지? 대박이었어! 🎉
그리고 **수여동사**도 완전 잘했어! 이번에도 그 실력 보여줄 거지? ✨
그럼 오늘 숙제 도와줄까? 🐰"
```

### 예시 2: 정답 피드백 시 강점 언급
```typescript
// 학생이 "감각동사" 문제를 맞춤
// strengths에 '감각동사' 포함됨

// AI Agent 행동
"딩동댕! 맞았어! 🐰✨
역시 **감각동사**는 네 강점이지! 완벽해! 🌟
감각동사는 우리 몸의 감각을 나타내는 동사야..."
```

### 예시 3: 약점 영역 집중 설명
```typescript
// 학생 데이터
agentMemory: {
  frequentMistakes: ['3형식 vs 4형식', 'to부정사 vs 동명사'],
  strengths: ['감각동사']
}

// AI Agent 행동
"[자주 틀리는 유형: 3형식 vs 4형식]
이 부분은 특히 자세히 설명해줘
→ 3형식과 4형식의 차이를 더 구체적으로 설명
→ 추가 예시 제공
→ 확인 문제 제공"
```

## 🎓 요약

### AI Agent의 핵심
1. **기억**: 학생별 데이터 저장 및 활용
2. **적응**: 학생 실력에 맞는 맞춤 학습
3. **선제적 행동**: 칭찬, 동기부여, 개입
4. **지속적 개선**: 시간이 지날수록 더 정확한 분석

### 데이터 의존성
- **Cold Start**: 데이터 없을 때 기본 규칙 사용
- **데이터 축적**: 세션 진행하면서 자동 수집
- **데이터 활용**: 축적된 데이터로 맞춤 칭찬 및 학습 제공

### 칭찬 기능
- **데이터 없을 때**: 일반 칭찬만
- **데이터 있을 때**: 맞춤 칭찬 (strengths 활용) ⭐

