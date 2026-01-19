# 멀티모달 AI Agent 개선 방안 (Gemini Live 스타일)

## 현재 시스템 분석

### 현재 방식
1. **이미지 분석 단계** (`/api/images/analyze`):
   - 이미지를 base64로 변환
   - Gemini 2.5 Pro에 이미지 + 프롬프트 전달
   - OCR 결과 (extractedText) 추출
   - 문제 인식 (recognizedProblems)
   - 마커 인식 (priorityMarkers)

2. **요약본 생성 단계** (`/api/lecture/summary`):
   - 추출된 텍스트만 사용
   - 텍스트 기반으로 복습 프로그램 생성

3. **튜터 대화 단계** (`/api/homework/help`):
   - 추출된 텍스트만 사용
   - 이미지는 참조하지 않음

### 문제점
- **정보 손실**: OCR 결과만 사용하므로 이미지의 시각적 정보 손실
  - 수식의 배치, 그래프의 형태, 표의 구조 등
  - 학생의 손글씨 스타일, 밑줄 위치 등
- **컨텍스트 부족**: 학생이 특정 부분을 질문할 때 정확히 무엇을 가리키는지 알 수 없음
- **기계적 설명**: 텍스트만 보고 설명하므로, 책 내용을 그대로 읽는 느낌

## Gemini Live 스타일 멀티모달 방식

### 핵심 개념
Gemini Live는 이미지를 **벡터로 변환하지 않고**, 이미지 자체를 모델에 직접 전달합니다:
- 이미지 → base64 인코딩 → Gemini API (inlineData)
- 모델이 이미지의 픽셀 정보를 직접 이해
- 텍스트 질문과 이미지를 **동시에** 처리

### 기술적 구현
```typescript
// 현재 우리 시스템에서 이미 사용 중 (이미지 분석 API)
const r = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      {
        inlineData: {
          data: base64Image,  // 이미지를 base64로 인코딩
          mimeType: 'image/jpeg',
        },
      },
      { text: prompt },  // 텍스트 프롬프트
    ],
  }],
});
```

## 개선 방안

### 1. 튜터 API에 이미지 직접 전달 (Priority: High)

**현재 문제:**
```typescript
// 현재: 텍스트만 사용
const prompt = `
[오늘 과외 페이지 내용 (이미지에서 추출한 텍스트)]
${context.extractedText || '(텍스트 없음)'}
`;
```

**개선:**
```typescript
// 개선: 이미지 + 텍스트 동시 전달
const imageUrl = rp.source?.imageUrl;
let parts: any[] = [];

// 이미지가 있으면 함께 전달
if (imageUrl) {
  const imageBuffer = await fetchImageBuffer(imageUrl);
  const base64Image = imageBuffer.toString('base64');
  parts.push({
    inlineData: {
      data: base64Image,
      mimeType: 'image/jpeg',
    },
  });
}

parts.push({ text: prompt });

const r = await model.generateContent({
  contents: [{ role: 'user', parts }],
});
```

**장점:**
- AI가 이미지를 직접 보면서 설명 가능
- 학생이 "이 그래프 부분" 같은 질문에 정확히 응답
- 수식, 도형, 표의 시각적 구조 이해
- 책 내용을 그대로 읽지 않고, 이미지를 보며 자연스럽게 설명

### 2. 컨텍스트 기반 질문 응답 (Priority: Medium)

**시나리오:**
- 학생: "이 문제 어떻게 풀어?"
- AI: 이미지를 보면서 해당 문제 위치를 찾고, 문제 내용과 그림/표를 모두 참고하여 설명

**구현:**
```typescript
// 학생 메시지 + 이미지 위치 정보
if (studentMessage.includes('이 문제') || studentMessage.includes('이 부분')) {
  // 현재 설명 중인 문제의 position 정보 활용
  const currentProblem = practice[current.idx];
  const position = currentProblem?.position;
  
  // 이미지 + 위치 정보 + 질문
  const prompt = `
이미지에서 ${currentProblem.number}번 문제 부분을 보고,
학생 질문: "${studentMessage}"
이 문제를 단계별로 설명해줘.
`;
}
```

### 3. 실시간 이미지 참조 (Priority: Medium)

**시나리오:**
- 학생이 채팅 중에 "이 그림은 뭐야?" 질문
- AI가 이미지의 해당 부분을 직접 보면서 설명

**구현:**
```typescript
// 학생 메시지에 이미지 참조 키워드가 있으면
const hasImageReference = /이 그림|이 표|이 그래프|이 도형|여기|이거/.test(studentMessage);

if (hasImageReference && imageUrl) {
  // 이미지를 함께 전달하여 설명
  parts.push({ inlineData: { data: base64Image, mimeType } });
}
```

### 4. 단계별 점진적 개선 (Priority: Low)

**Phase 1: 기본 멀티모달 통합**
- 튜터 API에 이미지 전달 기능 추가
- 모든 대화에서 이미지 컨텍스트 유지

**Phase 2: 위치 기반 설명**
- 문제의 position 정보 활용
- "N번 문제" 질문 시 해당 위치 참조

**Phase 3: 실시간 이미지 질의응답**
- 학생이 특정 부분을 가리킬 때 해당 영역 분석
- 크롭/좌표 기반 부분 이미지 전달

## 기술적 고려사항

### 1. API 비용
- 이미지를 매번 전달하면 토큰 비용 증가
- 하지만 Gemini는 이미지 토큰이 텍스트보다 효율적
- **해결책**: 캐싱 또는 필요 시에만 전달

### 2. 응답 시간
- 이미지 전달 시 응답 시간 증가 가능
- **해결책**: 
  - 첫 응답에만 이미지 포함
  - 또는 이미지 컨텍스트가 필요한 경우에만

### 3. 이미지 크기
- 큰 이미지는 토큰 비용 증가
- **해결책**: 
  - 이미지 최적화 (리사이즈, 압축)
  - 또는 필요한 부분만 크롭

## 구현 우선순위

1. **Priority 1 (High)**: 튜터 API에 이미지 전달 기능 추가
   - 가장 큰 개선 효과
   - 상대적으로 구현 난이도 낮음
   - 즉시 AI 설명 품질 향상

2. **Priority 2 (Medium)**: 위치 기반 설명
   - 문제 position 정보 활용
   - "N번 문제" 질문 시 정확한 응답

3. **Priority 3 (Low)**: 실시간 이미지 질의응답
   - 고급 기능
   - 사용자 경험 대폭 향상

## 결론

현재 우리 시스템은 **이미 멀티모달 인프라를 가지고 있습니다**:
- 이미지 분석 API에서 이미지를 base64로 변환하여 Gemini에 전달
- Gemini 2.5 Pro는 멀티모달 처리 지원

**개선 포인트:**
- 튜터 API에서도 이미지를 함께 전달하면, Gemini Live 스타일의 자연스러운 설명이 가능
- 학생이 이미지를 보면서 질문할 때, AI도 같은 이미지를 보며 정확하게 답변 가능
- 책 내용을 그대로 읽는 것이 아니라, 이미지를 이해하고 자연스럽게 설명하는 AI Agent가 됨

이는 **완전히 가능하며, 기술적으로 이미 준비되어 있습니다**!

