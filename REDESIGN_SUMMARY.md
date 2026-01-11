# HW Helper 전체 개편 요약

## 개편 목표
ChatGPT 대화 내용을 바탕으로 학생 숙제 수행률을 높이는 AI 튜터 시스템으로 전면 개편

## 핵심 기능

### 1. ✅ 이미지 업로드 및 분석 시스템
- **사진 촬영/업로드**: 카메라 또는 갤러리에서 이미지 업로드
- **OCR + 문제 인식**: Gemini AI로 이미지에서 텍스트 추출 및 문제 자동 인식
- **API 엔드포인트**:
  - `POST /api/images/upload` - 이미지 업로드
  - `GET /api/images/[id]` - 이미지 서빙
  - `POST /api/images/analyze` - 이미지 분석 (OCR + 문제 인식)

### 2. ✅ 이해 회복 엔진 (Understanding Recovery Engine)
- **멈춤 감지 시스템**: 이벤트 로깅 기반으로 학생의 멈춤 신호 감지
  - 무입력 정지 (idle_tick)
  - 수정/삭제 반복 (edit_burst)
  - 앱 이탈 (focus_lost, app_background)
  - 힌트 소비 패턴 분석
- **개입 트리거**: stuck_score 계산 (40점/65점/85점 기준)
  - 40점: 1차 개입 (가벼운 체크인)
  - 65점: 2차 개입 (절반 성공 미션)
  - 85점: 탈출구 제공
- **절반 성공 미션**: 학생이 성공할 수 있는 90% 확률의 미션 제공
  - 조건 정리형
  - 식 세우기형
  - 계산형

### 3. ✅ AI 튜터 세션 시스템
- **단계별 체크포인트**: 조건정리 → 식세우기 → 계산 → 검산
- **대화형 학습**: AI 튜터와 실시간 대화
- **API 엔드포인트**:
  - `POST /api/events` - 학습 이벤트 로깅
  - `POST /api/tutor/intervention` - AI 개입 (1차/2차/탈출구)

### 4. 📋 학습 고민 상담 (구현 필요)
- AI 튜터와 학습 방법 상담
- 학습 패턴 분석 및 조언
- **API 필요**: `POST /api/consultation`

### 5. 📋 수행평가 도움 (구현 필요)
- 수행평가 준비 지원
- 브레인스토밍, 구조 제안, 피드백 제공
- **API 필요**: `POST /api/performance-tasks`

### 6. 📋 복습 프로그램 (구현 필요)
- 과외 후 1시간 복습 프로그램 자동 생성
- 핵심 정리, 연습 문제, 퀴즈 제공
- **API 필요**: `POST /api/review-programs`

## 데이터 구조 확장

### 새로운 타입
- `ImageUpload`: 이미지 업로드 정보 및 분석 결과
- `AITutorSession`: AI 튜터 세션 (이해 회복 엔진)
- `LearningEvent`: 학습 이벤트 로그 (멈춤 감지용)
- `LearningConsultation`: 학습 고민 상담
- `PerformanceTask`: 수행평가
- `ReviewProgram`: 복습 프로그램

### 확장된 타입
- `Assignment`: `subject`, `sessionType`, `isReviewProgram` 등 추가
- `Problem`: `checkpoints`, `stuckPoint`, `understandingScore` 등 추가
- `ProblemStatus`: `not_started` 추가

## UI/UX 개편

### 반응형 디자인
- 태블릿/PC/모바일 지원
- 터치 친화적 인터페이스
- 메인 홈 페이지 (`/home`): 5가지 메뉴 제공
  - 교재/문제 촬영
  - 숙제 관리
  - 학습 고민 상담
  - 수행평가 도움
  - 복습 프로그램

### 컴포넌트
- `ImageUploader`: 이미지 업로드 컴포넌트 (카메라/갤러리 지원)

## 다음 단계 구현 가이드

### 1. 문제 풀이 페이지에 멈춤 감지 통합
```typescript
// 문제 풀이 페이지에서 이벤트 로깅
useEffect(() => {
  let idleTimer: NodeJS.Timeout;
  let lastInputTime = Date.now();

  const logIdleTick = () => {
    const idleTime = Date.now() - lastInputTime;
    if (idleTime > 30000) { // 30초 이상 무입력
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          problemId,
          assignmentId,
          eventType: 'idle_tick',
          metadata: { idleTime },
        }),
      });
    }
  };

  idleTimer = setInterval(logIdleTick, 5000);
  
  return () => clearInterval(idleTimer);
}, [problemId]);
```

### 2. AI 개입 UI 컴포넌트
```typescript
// 멈춤 감지 시 AI 튜터 팝업 표시
const [tutorIntervention, setTutorIntervention] = useState(null);

useEffect(() => {
  // 이벤트 로깅 후 멈춤 감지되면 개입 요청
  if (stuckScore >= 40) {
    fetch('/api/tutor/intervention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problemId,
        studentId,
        interventionType: stuckScore >= 85 ? 'escape_route' : stuckScore >= 65 ? 'half_mission' : 'check_in',
        stuckPoint: detectedStuckPoint,
      }),
    }).then(res => res.json()).then(data => {
      setTutorIntervention(data.intervention);
    });
  }
}, [stuckScore]);
```

### 3. 학습 고민 상담 API
```typescript
// app/api/consultation/route.ts
POST /api/consultation
- 학생의 고민 입력
- AI 튜터 응답 생성
- 대화 히스토리 저장
```

### 4. 수행평가 도움 API
```typescript
// app/api/performance-tasks/route.ts
POST /api/performance-tasks
- 수행평가 정보 입력
- AI로 브레인스토밍, 구조 제안, 피드백 생성
```

### 5. 복습 프로그램 API
```typescript
// app/api/review-programs/route.ts
POST /api/review-programs
- 원본 과외 세션 정보 입력
- AI로 핵심 정리, 연습 문제, 퀴즈 자동 생성
```

## 환경 변수
`.env.local` 파일에 다음 추가 필요 없음 (기존과 동일):
```
MONGODB_URI=mongodb://localhost:27017/seoltab_hwhelper
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

## 디렉토리 구조
```
app/
├── home/              # 새로운 메인 홈 페이지
│   ├── page.tsx
│   └── page.module.css
├── components/
│   ├── ImageUploader.tsx      # 이미지 업로드 컴포넌트
│   └── ImageUploader.module.css
├── api/
│   ├── images/
│   │   ├── upload/route.ts    # 이미지 업로드
│   │   ├── analyze/route.ts   # 이미지 분석
│   │   └── [id]/route.ts      # 이미지 서빙
│   ├── events/route.ts        # 이벤트 로깅
│   └── tutor/
│       └── intervention/route.ts  # AI 개입
lib/
├── types.ts           # 확장된 타입 정의
└── db.ts              # 새로운 컬렉션 추가
uploads/
└── images/            # 업로드된 이미지 저장 디렉토리
```

## 구현 우선순위

### Phase 1: 핵심 기능 (완료 ✅)
- [x] 이미지 업로드 및 분석
- [x] 멈춤 감지 시스템
- [x] AI 튜터 개입 기본 구조
- [x] 반응형 홈 페이지

### Phase 2: 통합 (진행 중)
- [ ] 문제 풀이 페이지에 이벤트 로깅 통합
- [ ] AI 개입 UI 컴포넌트 구현
- [ ] 체크포인트 단계 UI 구현

### Phase 3: 추가 기능
- [ ] 학습 고민 상담
- [ ] 수행평가 도움
- [ ] 복습 프로그램

## 주요 개선 사항

### 기존 시스템 vs 새 시스템

| 구분 | 기존 | 개편 후 |
|------|------|---------|
| 문제 입력 | 수동 입력 | 사진 촬영 + AI 자동 인식 |
| 멈춤 감지 | 없음 | 이벤트 기반 자동 감지 |
| AI 도움 | 수동 요청 (막혔어요 버튼) | 자동 개입 (멈춤 감지 시) |
| 힌트 방식 | 4단계 고정 | 상황별 맞춤 (체크인/절반미션/탈출구) |
| 성공 경험 | 없음 | 절반 성공 미션으로 설계 |
| 학습 관리 | 과제 중심 | 전체 학습 생태계 (상담/수행평가/복습) |

## 참고 사항

1. **멈춤 감지 정확도**: 이벤트 로깅 빈도와 임계값은 실제 사용 데이터로 조정 필요
2. **AI 프롬프트 최적화**: 실제 학생 반응에 따라 프롬프트 개선 필요
3. **이미지 저장**: 현재는 로컬 파일 시스템, 프로덕션에서는 S3/R2 등 클라우드 스토리지 권장
4. **성능**: 이미지 분석은 비동기 처리 권장 (큐 시스템 활용)

## 테스트 방법

1. 이미지 업로드 테스트
   ```bash
   # 메인 페이지 → 교재/문제 촬영 → 이미지 업로드
   ```

2. 멈춤 감지 테스트
   ```bash
   # 문제 풀이 페이지에서 45초 이상 입력 없음
   # → 자동으로 이벤트 로깅 → AI 개입 트리거
   ```

3. AI 개입 테스트
   ```bash
   POST /api/tutor/intervention
   {
     "problemId": "...",
     "studentId": "...",
     "interventionType": "check_in",
     "stuckPoint": "equation"
   }
   ```
