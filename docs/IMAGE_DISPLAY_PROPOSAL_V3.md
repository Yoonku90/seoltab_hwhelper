# 이미지 표시 방식 개선 제안 (V3 - 같은 행 배치)

## 🎯 사용자 요청

### 요구사항:
- ✅ 채팅 입력창과 **같은 행(row)**에 이미지 썸네일 배치
- ✅ 스크롤 없이 항상 접근 가능
- ✅ 공간 효율적

## ✅ 제안 방식: 입력창과 같은 행에 썸네일 배치

### 레이아웃 구조:

#### 방법 1: 입력 필드 왼쪽에 썸네일 (추천)
```
┌─────────────────────────────────────┐
│ [📷 50px] [입력 필드...] [전송]     │
└─────────────────────────────────────┘
```

#### 방법 2: 입력 필드와 전송 버튼 사이에 썸네일
```
┌─────────────────────────────────────┐
│ [입력 필드...] [📷 50px] [전송]     │
└─────────────────────────────────────┘
```

#### 방법 3: 전송 버튼 오른쪽에 썸네일
```
┌─────────────────────────────────────┐
│ [입력 필드...] [전송] [📷 50px]     │
└─────────────────────────────────────┘
```

## 🎨 시각적 레이아웃

### 데스크톱/태블릿 (방법 1 - 추천):
```
┌───────────────────────────────────────────────────┐
│ [채팅 로그]                                       │
│  메시지...                                        │
│  메시지...                                        │
│                                                   │
├───────────────────────────────────────────────────┤
│ ┌─────┐ ┌──────────────────────────┐ ┌──────┐   │
│ │ 📷  │ │ [입력 필드...]            │ │ 전송 │   │
│ │50x50│ │                           │ └──────┘   │
│ └─────┘ └──────────────────────────┘            │
│ "이미지를 보려면 클릭하세요! 👆" (썸네일 아래)   │
└───────────────────────────────────────────────────┘
```

### 모바일 (방법 1):
```
┌─────────────────────────┐
│ [채팅 로그]             │
│   메시지...             │
│                         │
├─────────────────────────┤
│ ┌───┐ ┌────────┐ ┌───┐ │
│ │📷 │ │[입력]   │ │전송│ │
│ │40 │ └────────┘ └───┘ │
│ └───┘                  │
│ "클릭해서 보기 👆"      │
└─────────────────────────┘
```

## 💡 구현 방법

### 방법 1: 입력 필드 왼쪽에 썸네일 (추천) ⭐

#### 구조:
```tsx
<div className={styles.inputRow}>
  {/* 이미지 썸네일 (입력 필드 왼쪽) */}
  {pageImageUrl && (
    <div className={styles.imageThumbnailInRow}>
      <div 
        className={styles.rowImageThumbnail}
        onClick={() => {
          // 확대 모달 로직 (기존과 동일)
        }}
        title="페이지 이미지 보기"
      >
        <img src={pageImageUrl} alt="과외 페이지" />
      </div>
      {/* 텍스트는 썸네일 아래 또는 hover 시 표시 */}
    </div>
  )}
  
  {/* 입력 필드 */}
  <input
    className={styles.input}
    value={input}
    onChange={...}
    placeholder="답을 적어도 되고, 수업 중 궁금한 건 언제든 물어봐 🐰"
    ...
  />
  
  {/* 전송 버튼 */}
  <button className={styles.sendBtn} ...>
    전송
  </button>
</div>
```

#### CSS:
```css
.inputRow {
  display: flex;
  align-items: center; /* 세로 중앙 정렬 */
  gap: 10px;
  padding: 12px;
  background: #fff;
}

/* 입력 행 내 썸네일 */
.imageThumbnailInRow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.rowImageThumbnail {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  border: 2px solid #e9eef6;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafafa;
  flex-shrink: 0;
}

.rowImageThumbnail:hover {
  border-color: #2196f3;
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.2);
}

.rowImageThumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 텍스트 안내 (선택적 - 썸네일 아래 또는 hover) */
.rowImageHint {
  font-size: 9px;
  color: #999;
  text-align: center;
  white-space: nowrap;
  max-width: 50px;
  line-height: 1.2;
}

.input {
  flex: 1; /* 남은 공간 차지 */
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 12px 12px;
  font-size: 14px;
}

.sendBtn {
  /* 기존 스타일 유지 */
}

/* 모바일 */
@media (max-width: 768px) {
  .rowImageThumbnail {
    width: 40px;
    height: 40px;
  }
  .rowImageHint {
    font-size: 8px;
    max-width: 40px;
  }
}
```

### 방법 2: 입력 필드와 전송 버튼 사이에 썸네일

#### 구조:
```tsx
<div className={styles.inputRow}>
  <input className={styles.input} ... />
  
  {pageImageUrl && (
    <div className={styles.imageThumbnailInRow}>
      {/* 썸네일 */}
    </div>
  )}
  
  <button className={styles.sendBtn} ...>전송</button>
</div>
```

### 방법 3: 전송 버튼 오른쪽에 썸네일

#### 구조:
```tsx
<div className={styles.inputRow}>
  <input className={styles.input} ... />
  <button className={styles.sendBtn} ...>전송</button>
  
  {pageImageUrl && (
    <div className={styles.imageThumbnailInRow}>
      {/* 썸네일 */}
    </div>
  )}
</div>
```

## 🎯 텍스트 안내 처리 방법

### 옵션 1: 썸네일 아래 작은 텍스트 (추천)
```
┌─────┐
│ 📷  │
│50x50│
└─────┘
"클릭 👆"
```

### 옵션 2: Hover 시 툴팁 표시
- 기본: 썸네일만
- Hover: "이미지를 보려면 클릭하세요!" 툴팁 표시

### 옵션 3: 텍스트 없이 아이콘만
- 썸네일만 표시
- 클릭 가능함을 시각적으로만 표현 (border, hover 효과)

## 📐 크기 비교

### 현재:
- 위치: 입력창 위 (별도 영역)
- 크기: max-height: 150px (매우 큼)
- 공간: 입력창 위 150px + 여백

### 제안 (방법 1):
- 위치: 입력창과 같은 행 (왼쪽)
- 크기: 50x50px (작음)
- 공간: 입력창 행 내부 50px만 차지

## ✅ 장점

1. ✅ **스크롤 불필요**: 입력창과 같은 행에 있어서 항상 보임
2. ✅ **공간 효율적**: 별도 행이 아닌 입력창 행 내부에 배치
3. ✅ **학습 내용을 가리지 않음**: 작은 크기 (50px)
4. ✅ **접근성**: 입력창 근처에 있어서 항상 접근 가능
5. ✅ **깔끔한 레이아웃**: 입력창과 자연스럽게 통합

## 🔄 Before vs After

### Before (현재):
```
[채팅 로그]
메시지...

[📷 큰 이미지 - 별도 행]
┌─────────────────┐
│   이미지        │ ← 150px 높이, 별도 행
│   (150px)       │
└─────────────────┘

[입력창]
[입력 필드] [전송]
```

### After (제안 - 방법 1):
```
[채팅 로그]
메시지...
메시지...

[입력창 - 같은 행]
[📷 50px] [입력 필드...] [전송]
   └─ 같은 행에 배치!
```

## 🎨 최종 추천 레이아웃

### 추천: 방법 1 (입력 필드 왼쪽에 썸네일)

```
┌──────────────────────────────────────┐
│ [채팅 로그]                          │
│  메시지...                           │
│                                      │
├──────────────────────────────────────┤
│ ┌─────┐ ┌─────────────────┐ ┌─────┐ │
│ │ 📷  │ │ [입력 필드...]   │ │전송 │ │
│ │50px │ └─────────────────┘ └─────┘ │
│ └─────┘                              │
│  (선택적) "클릭해서 보기 👆"          │
└──────────────────────────────────────┘
```

### 장점:
- ✅ 입력창과 같은 행에 있어서 스크롤 불필요
- ✅ 왼쪽에 배치하여 입력 필드가 중앙에 위치
- ✅ 공간 효율적 (별도 행 불필요)
- ✅ 작은 크기로 학습 내용을 가리지 않음

## 📝 구현 체크리스트

- [ ] `.inputRow`에 썸네일 추가 (왼쪽, 중간, 또는 오른쪽 선택)
- [ ] 썸네일 크기: 50x50px (데스크톱) / 40x40px (모바일)
- [ ] 텍스트 안내 처리 (아래, hover, 또는 없음)
- [ ] 클릭 시 확대 모달 기능 유지
- [ ] 모바일 반응형 확인
- [ ] 기존 `.pageImageNearInput` 제거

