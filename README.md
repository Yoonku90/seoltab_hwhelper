# Seoltab Homework Helper

학생 숙제 관리 시스템 - 숙제 시작 → 막힘 해결 → 질문 5개로 압축 → 선생님 수업 전 파악

## 기능

1. **숙제 세션**: 문제 리스트 + 상태 관리 (풀었어요 / 막혔어요 / 질문할래요)
2. **막힘 버튼**: 단계별 AI 힌트 (1-4단계)
3. **Top5 질문 확정**: 수업 전 최대 5개 질문 선택
4. **선생님 대시보드**: 학생별 진행률, 막힘 수, Top5 요약

## 기술 스택

- Next.js 15
- TypeScript
- MongoDB
- Google Generative AI (Gemini)

## 환경 설정

`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```
MONGODB_URI=mongodb://localhost:27017/seoltab_hwhelper
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
# LECTURE_API_BASE_URL (선택사항) - 기본값: https://lecture-analysis-pipeline-api.seoltab.com/report-backend
```

## 실행

```bash
npm install
npm run dev
```

## 초기 설정

1. MongoDB가 실행 중인지 확인하세요.
2. 인덱스 생성:
   - 브라우저에서 `http://localhost:3000/api/init` 접속
   - 또는 `npx tsx scripts/create-indexes.ts` 실행

## 주요 API 엔드포인트

### 학생 API
- `GET /api/assignments?studentId=xxx` - 과제 리스트
- `GET /api/assignments/:id/session` - 과제 세션 조회
- `POST /api/problems/:id/status` - 문제 상태 업데이트
- `POST /api/problems/:id/help?step=1..4` - 단계별 힌트

### 선생님 API
- `GET /api/teachers/:id/dashboard` - 대시보드 조회
- `POST /api/assignments/:id/digest/generate` - Digest 생성
- `GET /api/assignments/:id/digest` - Digest 조회

### Top5 API
- `POST /api/assignments/:id/top5/confirm` - Top5 질문 확정

### Lecture STT API
- `GET /api/lecture/search?lvt={lvt}` - LVT로 Room 목록 검색
- `GET /api/lecture/search?roomId={roomId}` - Room ID로 검색
- `GET /api/lecture/text?roomId={roomId}` - 단일 Room의 STT 텍스트 조회
- `POST /api/lecture/text` - 배치로 여러 Room의 STT 텍스트 조회 (Body: `{ room_ids: string[] }`)

## 화면 구조

- `/` - 학생 과제 리스트
- `/assignments/:id` - 숙제 세션 (문제 리스트 + 상태 관리)
- `/assignments/:id/top5` - Top5 질문 확정
- `/teachers/:id/dashboard` - 선생님 대시보드

## 데이터베이스 컬렉션

1. `assignments` - 과제
2. `pages` - 교재 페이지 이미지
3. `problems` - 문제 (문항)
4. `attempts` - 시도 로그/히스토리
5. `help_sessions` - AI 도움 로그
6. `teacher_digests` - Top5 + 요약

