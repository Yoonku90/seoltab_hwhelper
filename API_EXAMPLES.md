# API 사용 예시

## 학생 API

### 1. 과제 리스트 조회
```bash
GET /api/assignments?studentId=student1
```

응답:
```json
{
  "assignments": [
    {
      "_id": "...",
      "title": "영어 숙제",
      "dueAt": "2024-01-15T00:00:00.000Z",
      "progress": {
        "total": 10,
        "solved": 5,
        "stuck": 3,
        "question": 2
      },
      "lastActivityAt": "2024-01-10T12:00:00.000Z",
      "top5Confirmed": false
    }
  ]
}
```

### 2. 과제 세션 조회
```bash
GET /api/assignments/:assignmentId/session
```

응답:
```json
{
  "assignment": {
    "_id": "...",
    "title": "영어 숙제",
    "progress": { ... }
  },
  "problems": [
    {
      "_id": "...",
      "problemNumber": 1,
      "problemText": "문제 내용",
      "imageUrl": "/api/files/xxx.jpg",
      "latestAttempt": {
        "status": "stuck",
        "updatedAt": "2024-01-10T12:00:00.000Z",
        "timeSpent": 300
      }
    }
  ]
}
```

### 3. 문제 상태 업데이트
```bash
POST /api/problems/:problemId/status
Content-Type: application/json

{
  "status": "solved",  // "solved" | "stuck" | "question"
  "studentId": "student1",
  "timeSpent": 300  // 초 단위 (선택)
}
```

### 4. 단계별 힌트 요청
```bash
POST /api/problems/:problemId/help?step=1
Content-Type: application/json

{
  "studentId": "student1"
}
```

응답:
```json
{
  "step": 1,
  "hintTitle": "문제 이해하기",
  "hintText": "이 문제는...",
  "nextAction": "다음 단계로 넘어가시겠어요?"
}
```

## 선생님 API

### 1. 대시보드 조회
```bash
GET /api/teachers/:teacherId/dashboard
```

응답:
```json
{
  "dashboard": [
    {
      "assignmentId": "...",
      "title": "영어 숙제",
      "studentId": "student1",
      "progress": { ... },
      "top5Confirmed": true,
      "digest": {
        "top5Problems": [
          {
            "problemId": "...",
            "problemNumber": 1,
            "problemText": "...",
            "stuckReason": "...",
            "timeSpent": 300
          }
        ],
        "summary": {
          "totalProblems": 10,
          "solved": 5,
          "stuck": 3,
          "question": 2,
          "commonStuckReasons": ["..."],
          "averageTimeSpent": 250
        }
      }
    }
  ]
}
```

### 2. Digest 생성
```bash
POST /api/assignments/:assignmentId/digest/generate
```

### 3. Digest 조회
```bash
GET /api/assignments/:assignmentId/digest
```

## Top5 API

### Top5 질문 확정
```bash
POST /api/assignments/:assignmentId/top5/confirm
Content-Type: application/json

{
  "problemIds": ["problem1", "problem2", "problem3", "problem4", "problem5"],
  "studentId": "student1"
}
```

응답:
```json
{
  "success": true,
  "confirmedCount": 5
}
```

