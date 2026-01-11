# MongoDB 없이 시작하기

MVP 단계에서 MongoDB 없이 빠르게 시작할 수 있는 방법입니다.

## 방법 1: 파일 기반 스토리지 (권장)

`lib/storage.ts`를 사용하면 JSON 파일로 데이터를 저장합니다.

### 설정

1. `lib/db.ts`를 수정하여 `SimpleStorage` 사용:

```typescript
// lib/db.ts 수정 예시
import { SimpleStorage } from './storage';

// MongoDB 대신 SimpleStorage 사용
export const Collections = {
  assignments: () => SimpleStorage as any,
  // ... 나머지도 동일
};
```

2. API 라우트에서 `SimpleStorage` 직접 사용:

```typescript
// app/api/assignments/route.ts 예시
import { SimpleStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId');
  const assignments = await SimpleStorage.getAssignments({ studentId });
  return NextResponse.json({ assignments });
}
```

### 장점
- MongoDB 설치 불필요
- 빠른 프로토타이핑
- 데이터는 `data/` 폴더에 JSON 파일로 저장

### 단점
- 동시성 문제 (여러 요청 시)
- 확장성 제한
- 프로덕션에는 부적합

## 방법 2: 로컬 스토리지 (브라우저만)

클라이언트 사이드에서만 동작하는 경우:

```typescript
// 클라이언트 컴포넌트에서
const [assignments, setAssignments] = useState(() => {
  const stored = localStorage.getItem('assignments');
  return stored ? JSON.parse(stored) : [];
});

const saveAssignment = (assignment: Assignment) => {
  const updated = [...assignments, assignment];
  setAssignments(updated);
  localStorage.setItem('assignments', JSON.stringify(updated));
};
```

## 방법 3: MongoDB 사용 (프로덕션)

여러 사용자, 데이터 영속성, 확장성이 필요한 경우:

1. MongoDB 설치 및 실행
2. `.env.local`에 `MONGODB_URI` 설정
3. 기존 코드 그대로 사용

## 추천

- **개발/테스트**: 파일 기반 스토리지 (`lib/storage.ts`)
- **프로덕션**: MongoDB

