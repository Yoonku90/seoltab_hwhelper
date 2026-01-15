# 요약본 생성 및 저장 프로세스

## 데이터 저장 프로세스

### 1. 요약본 생성 API (`POST /api/lecture/summary`)

**입력:**
- `roomId`: 수업 방 ID

**처리 단계:**

1. **Room 메타데이터 가져오기**
   - `LECTURE_API_BASE_URL/meta/room/{roomId}` 호출
   - `subject`, `tutoring_datetime` 추출

2. **STT 텍스트 가져오기**
   - `LECTURE_API_BASE_URL/text/batch` 호출 (POST)
   - `room_ids: [roomId]` 전송
   - S3 presigned URL이 있으면 다운로드
   - JSON의 `NaN` 값을 `null`로 변환
   - 놓친 부분(missedParts) 분석

3. **교재 이미지 가져오기**
   - `/api/admin/room-images` 호출
   - Pagecall API에서 이미지 URL 목록 추출
   - `metadata.imageUrls`에 저장

4. **Gemini API로 요약본 생성**
   - 프롬프트 생성 (유은서 쌤 스타일)
   - 첫 번째 이미지를 base64로 변환하여 전달
   - JSON 형식으로 응답 받음

5. **MongoDB에 저장**
   - 컬렉션: `reviewPrograms`
   - 저장되는 필드:
     ```typescript
     {
       studentId: 'unknown', // Room ID만으로는 학생 특정 불가
       title: summaryData.title,
       subject: subject,
       reviewContent: {
         mode: 'concept',
         teacherMessage: ...,
         unitTitle: ...,
         conceptSummary: ...,
         textbookHighlight: ...,
         missedParts: [...],
         todayMission: ...,
         encouragement: ...,
       },
       intent: 'review',
       startAt: Date,
       createdAt: Date,
       updatedAt: Date,
       originalSessionId: roomId,
       metadata: {
         roomId: roomId,
         tutoringDatetime: ...,
         imageCount: images.length,
         imageUrls: images, // 이미지 URL 목록
         hasStt: boolean,
         missedPartsCount: number,
         isSecretNote: true,
       }
     }
     ```

**출력:**
- `reviewProgramId`: 생성된 Review Program의 MongoDB ObjectId
- `summary`: 생성된 요약본 데이터
- `roomId`: 입력받은 Room ID

## 교재 이미지에서 동그라미 처리

### 현재 구현

동그라미는 **마커로 인식**됩니다:

1. **이미지 분석 API** (`POST /api/images/analyze`)
   - Gemini Vision API로 이미지 분석
   - 프롬프트에서 동그라미(○)를 마커로 지정:
     ```
     - 동그라미(○)로 표시된 부분
     ```
   - `priorityMarkers` 배열에 포함:
     ```json
     {
       "type": "circle",
       "problemNumber": 문제번호,
       "description": "설명",
       "priority": "medium"
     }
     ```

2. **우선순위 기준**
   - `high`: 별표(★), 물음표(?), X표시
   - `medium`: 체크(✓), **동그라미(○)**, 밑줄
   - `low`: 손글씨 메모

3. **OCR 텍스트 추출**
   - 현재는 동그라미를 텍스트에서 제외하는 로직이 **없습니다**
   - Gemini가 OCR할 때 동그라미 기호(○)가 텍스트에 포함될 수 있음

### 개선 필요 사항

동그라미를 OCR 텍스트에서 제외하려면:
- 프롬프트에 "동그라미 기호(○)는 텍스트 추출에서 제외하세요" 지시 추가
- 또는 후처리에서 OCR 텍스트의 동그라미 기호 제거

## 시험지 가져오기 및 문제 정답 판단

### 시험지 가져오기 기준

현재 구현에서는 **명시적인 시험지 가져오기 로직이 없습니다**:

- 요약본 생성 시: Room ID로 교재 이미지를 가져옴 (`/api/admin/room-images`)
- 복습 프로그램 생성 시: 학생이 업로드한 이미지 사용 (`ImageUploader` 컴포넌트)

### 문제 정답 판단 기준

**요약본 생성 시:**
- STT 분석으로 "놓친 부분" 감지:
  - 학생이 "모르겠어요", "잘 모르겠는데요" 등 불확실한 답변
  - 선생님이 질문했는데 학생이 대답 못한 경우

**복습 프로그램 퀴즈 시:**
- 튜터 응답의 키워드로 판단 (`app/review-programs/[id]/page.tsx`):
  ```typescript
  const correctKeywords = ['딩동댕', '맞았어', '잘했어', '정답', '완전 맞았어', '완벽해', '대박 정확해'];
  const incorrectKeywords = ['아깝다', '틀렸', '틀렸어', '다시 생각', '조금만 더'];
  
  const isCorrect = correctKeywords.some(keyword => message.includes(keyword.toLowerCase()));
  const isIncorrect = incorrectKeywords.some(keyword => message.includes(keyword.toLowerCase()));
  ```

**문제 상태 관리:**
- `POST /api/problems/:id/status` API 사용
- 상태: `solved`, `stuck`, `question`
- 각 상태는 학생이 직접 업데이트

## 이미지 크기 제한 문제

### 현재 문제

`review-programs/[id]/page.tsx`의 요약본 이미지가 잘림:
- CSS의 `max-height` 제한으로 인한 크롭
- `object-fit: cover` 사용으로 이미지 비율이 맞지 않을 때 잘림

### 해결 방법

1. **`object-fit: contain` 사용** (현재 `cover` 사용 중)
2. **이미지 그리드 크기 조정**
3. **이미지 클릭 시 확대 모달** (이미 구현됨)

