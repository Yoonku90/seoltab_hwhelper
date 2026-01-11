# 🧪 AI Agent 테스트 가이드

## 📋 개요

Priority 0-4까지 구현한 AI Agent 기능들을 테스트하는 가이드입니다.

---

## 🚀 빠른 시작

### 1. 서버 실행

```bash
npm run dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

### 2. 테스트 스크립트 실행

```bash
# TypeScript 직접 실행 (tsx 필요)
npx tsx scripts/test-agent-apis.ts

# 또는 ts-node 사용
npx ts-node scripts/test-agent-apis.ts
```

---

## 📝 테스트 항목

### ✅ 1. Event Collector (학습 이벤트 수집)

**API:** `POST /api/events`

**테스트 내용:**
- 학습 이벤트 수집 (concept_learned, problem_solved 등)
- 이벤트 타입 확장 확인
- metadata 필드 확인

**예시:**
```typescript
POST /api/events
{
  "studentId": "111111_481",
  "reviewProgramId": "test-id",
  "eventType": "concept_learned",
  "metadata": {
    "subject": "영어",
    "topic": "감각동사",
    "difficulty": 3,
    "timeSpent": 300,
    "score": 85
  }
}
```

---

### ✅ 2. Memory Update API (agentMemory 업데이트)

**API:** `POST /api/agent/memory/update`

**테스트 내용:**
- 학습 이벤트를 분석하여 agentMemory 업데이트
- recentTopics, frequentMistakes, strengths 계산
- 평균 점수 및 세션 수 계산

**예시:**
```typescript
POST /api/agent/memory/update
{
  "studentId": "111111_481"
}
```

---

### ✅ 3. Student Profile 조회 (agentMemory 확인)

**API:** `GET /api/students?studentId=111111_481`

**테스트 내용:**
- agentMemory 데이터 확인
- recentTopics, frequentMistakes, strengths 확인
- totalSessions, averageScore 확인

---

### ✅ 4. Pattern Analyzer (패턴 분석)

**함수:** `lib/agent/analyzer/pattern-analyzer.ts`

**테스트 내용:**
- 성능 추세 분석 (improving/stable/declining)
- 실수 패턴 분석
- 학습 효율 계산
- 추천 생성

**예시:**
```typescript
import { analyzeLearningPattern } from '@/lib/agent/analyzer/pattern-analyzer';

const analysis = await analyzeLearningPattern('111111_481');
console.log(analysis.performanceTrend);
console.log(analysis.learningEfficiency);
```

---

### ✅ 5. Adaptive Engine (적응형 학습)

**함수:** `lib/agent/adaptive/engine.ts`

**테스트 내용:**
- 적응형 학습 계획 생성
- 현재 수준 계산
- 학습 경로 생성
- 학습 속도 결정 (slow/normal/fast)

**예시:**
```typescript
import { generateAdaptivePlan } from '@/lib/agent/adaptive/engine';

const plan = await generateAdaptivePlan('111111_481', '고2', '영어');
console.log(plan.pace);
console.log(plan.learningPath);
```

---

### ✅ 6. Prediction Model (예측 모델)

**함수:** `lib/agent/prediction/predictor.ts`

**테스트 내용:**
- 성과 예측 (predictedScore)
- 신뢰도 계산
- 약점 영역 식별
- 추천 액션 생성

**예시:**
```typescript
import { predictPerformance } from '@/lib/agent/prediction/predictor';

const prediction = await predictPerformance('111111_481', '영어');
console.log(prediction.predictedScore);
console.log(prediction.weakAreas);
```

---

### ✅ 7. Intervention System (개입 시스템)

**함수:** `lib/agent/prediction/intervention.ts`

**테스트 내용:**
- 약점 조기 감지
- 개입 필요 여부 확인
- 개입 액션 생성 (suggest_review, revisit_concept 등)

**예시:**
```typescript
import { checkAndGenerateIntervention } from '@/lib/agent/prediction/intervention';

const intervention = await checkAndGenerateIntervention('111111_481', '영어');
if (intervention) {
  console.log(intervention.action);
  console.log(intervention.message);
}
```

---

## 🔗 통합 테스트

### 기존 시스템과의 통합

#### 1. Tutor API 통합 확인

`app/api/review-programs/tutor/next/route.ts`에서 이미 통합된 기능:
- ✅ Fallback Logic (recommendedDifficulty, recommendedLearningPath)
- ✅ Student Data Status (studentDataStatus, studentStrategy)
- ✅ Context에 추가 정보 제공

**확인 방법:**
1. 복습 프로그램 시작
2. Tutor API 응답의 context 확인
3. recommendedDifficulty, recommendedLearningPath 값 확인

---

#### 2. 이벤트 수집 통합 (필요 시)

**현재 상태:**
- Event Collector API는 구현되어 있음 (`/api/events`)
- 프론트엔드에서 자동으로 이벤트를 보내도록 통합 필요

**통합 방법:**
```typescript
// app/review-programs/[id]/page.tsx에서
// 학생이 문제를 맞췄을 때:
await fetch('/api/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentId: studentId,
    reviewProgramId: reviewProgramId,
    eventType: 'quiz_correct',
    metadata: {
      subject: subject,
      topic: currentTopic,
      score: 100,
    },
  }),
});
```

---

## 🐛 문제 해결

### 1. "Student not found" 에러

**원인:** 테스트 학생이 데이터베이스에 없음

**해결:**
```bash
# 학생 생성 API 호출
curl -X POST http://localhost:3001/api/students \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "111111_481",
    "name": "테스트",
    "grade": "고2"
  }'
```

---

### 2. "Memory Update 실패" 에러

**원인:** 학습 이벤트가 없어서 agentMemory 업데이트 불가

**해결:**
1. 먼저 이벤트 수집 테스트 실행
2. 그 다음 Memory Update 테스트 실행

---

### 3. "Module not found" 에러

**원인:** TypeScript 경로 설정 문제

**해결:**
```bash
# tsconfig.json 확인
# paths 설정이 올바른지 확인

# 또는 상대 경로로 변경
import { ... } from '../lib/agent/...';
```

---

## 📊 예상 결과

### 성공적인 테스트 결과:

```
🧪 AI Agent APIs 테스트 시작...
📍 API Base URL: http://localhost:3001
👤 테스트 학생 ID: 111111_481
==================================================

📝 [1] Event Collector 테스트...
✅ Event Collector 성공

🧠 [2] Memory Update API 테스트...
✅ Memory Update 성공

👤 [3] Student Profile 조회 테스트...
✅ Student Profile 조회 성공
   - 총 세션: 1
   - 최근 주제: ["감각동사"]
   - 평균 점수: 85

...

==================================================
📊 테스트 결과 요약:
==================================================
✅ Event Collector
✅ Memory Update
✅ Student Profile
✅ Pattern Analyzer
✅ Adaptive Engine
✅ Prediction Model
✅ Intervention System

==================================================
✅ 성공: 7개
❌ 실패: 0개
==================================================

🎉 모든 테스트가 성공했습니다!
```

---

## 🎯 다음 단계

테스트가 성공한 후:

1. **프론트엔드 통합**
   - 이벤트 수집 자동화
   - Memory Update 주기적 호출

2. **배치 처리 추가**
   - Cron Job으로 일일 Memory Update
   - 주기적 패턴 분석

3. **Admin 대시보드 확장**
   - 패턴 분석 결과 표시
   - 예측 결과 표시

---

## 📚 관련 문서

- `docs/AI_AGENT_ARCHITECTURE.md` - 아키텍처 설계
- `docs/AI_AGENT_COLD_START.md` - Cold Start 전략
- `docs/IMPLEMENTATION_FEASIBILITY.md` - 구현 가능 여부

