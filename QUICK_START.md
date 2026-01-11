# 빠른 시작 가이드

## 1단계: 의존성 설치

```bash
cd /Users/onuii/Documents/GitHub/seoltab_hwhelper
npm install
```

## 2단계: 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하세요:

```bash
# .env.local
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here

# MongoDB 사용하는 경우 (선택)
MONGODB_URI=mongodb://localhost:27017/seoltab_hwhelper
```

**Google Generative AI API 키 발급:**
1. [Google AI Studio](https://makersuite.google.com/app/apikey) 접속
2. "Create API Key" 클릭
3. 생성된 키를 `.env.local`에 입력

## 3단계: MongoDB 선택

### 옵션 A: MongoDB 사용 (프로덕션 권장)

1. MongoDB 설치 및 실행:
   ```bash
   # macOS (Homebrew)
   brew tap mongodb/brew
   brew install mongodb-community
   brew services start mongodb-community
   
   # 또는 Docker
   docker run -d -p 27017:27017 --name mongodb mongo
   ```

2. `.env.local`에 `MONGODB_URI` 추가 (위 참고)

3. 인덱스 생성:
   - 브라우저에서 `http://localhost:3000/api/init` 접속
   - 또는 `npx tsx scripts/create-indexes.ts` 실행

### 옵션 B: 파일 기반 스토리지 (빠른 시작)

MongoDB 없이 시작하려면:
- `lib/db.ts`를 수정하여 `SimpleStorage` 사용
- 또는 API 라우트를 `lib/storage.ts`를 사용하도록 수정

## 4단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

## 5단계: 테스트

### 학생 화면 테스트
1. `http://localhost:3000` 접속
2. 학생 ID 입력 (예: `student1`)
3. 과제 리스트 확인

### API 테스트
```bash
# 과제 생성 (예시)
curl -X POST http://localhost:3000/api/assignments \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "student1",
    "teacherId": "teacher1",
    "title": "테스트 과제",
    "dueAt": "2024-12-31T00:00:00.000Z"
  }'
```

## 문제 해결

### MongoDB 연결 오류
- MongoDB가 실행 중인지 확인: `mongosh` 또는 `mongo` 명령어로 확인
- `.env.local`의 `MONGODB_URI` 확인

### API 키 오류
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- API 키가 올바른지 확인
- 서버 재시작: `Ctrl+C` 후 `npm run dev` 다시 실행

### 포트 충돌
- 다른 포트 사용: `npm run dev -- -p 3001`

## 다음 단계

1. **테스트 데이터 생성**: 과제와 문제를 몇 개 생성해보세요
2. **화면 확인**: 학생 화면과 선생님 대시보드 확인
3. **AI 힌트 테스트**: 문제 상태를 "막혔어요"로 변경하고 "도움 받기" 클릭
4. **Top5 확정**: 질문할 문제를 선택하고 Top5 확정

