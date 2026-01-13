# 이미지 표시 방식 개선 제안 (V2)

## 🎯 사용자 피드백

### 문제점:
1. ❌ 헤더에 두면: 채팅이 길어질 때 스크롤을 올려야 이미지를 볼 수 있음
2. ❌ 현재 큰 이미지: 학습 내용을 가릴 수 있음

### 요구사항:
- ✅ 채팅 입력창 근처에 위치 (스크롤 없이 접근 가능)
- ✅ 예쁘게 배열
- ✅ 학습 내용을 가리지 않음

## ✅ 제안 방식: 채팅 입력창 위쪽에 작은 썸네일

### 레이아웃 구조:
```
[채팅 로그]
  - 메시지들...
  - 메시지들...
  - 메시지들...
  
[📷 작은 이미지 썸네일 영역] ← 새로 추가 (sticky)
  [📷 50x50px 썸네일]
  "이미지를 보려면 여기를 클릭하세요! 👆"
  
[채팅 입력창]
  [입력 필드] [전송 버튼]
```

### 핵심 아이디어:
1. **위치**: 채팅 입력창 **바로 위**에 배치
2. **크기**: 작은 썸네일 (50x50px 정도, 현재 150px보다 훨씬 작음)
3. **배치**: 입력창과 같은 너비, 예쁘게 정렬
4. **Sticky**: 입력창 위에 고정되어 항상 보임
5. **시각적 방해 최소화**: 작은 크기로 학습 내용을 가리지 않음

## 🎨 시각적 레이아웃

### 데스크톱/태블릿:
```
┌─────────────────────────────────────┐
│ [채팅 로그 영역]                     │
│  메시지...                          │
│  메시지...                          │
│  메시지...                          │
│                                     │
├─────────────────────────────────────┤
│ [📷 이미지 썸네일 영역 - Sticky]    │
│  ┌─────┐                           │
│  │ 📷  │  "이미지를 보려면          │
│  │50x50│  여기를 클릭하세요! 👆"    │
│  └─────┘                           │
├─────────────────────────────────────┤
│ [입력 필드] [전송]                  │
└─────────────────────────────────────┘
```

### 모바일:
```
┌──────────────────┐
│ [채팅 로그]      │
│   메시지...      │
│   메시지...      │
├──────────────────┤
│ [📷 40x40]       │
│ "이미지를 보려면 │
│  여기를 클릭하세요! 👆"│
├──────────────────┤
│ [입력] [전송]    │
└──────────────────┘
```

## 💡 구현 방법

### 방법 1: 입력창 위에 독립적인 썸네일 영역 (추천)

#### 구조:
```tsx
{/* 채팅 입력 영역 */}
<div className={styles.chatInputArea}>
  {/* 이미지 썸네일 (입력창 위) */}
  {pageImageUrl && (
    <div className={styles.imageThumbnailAboveInput}>
      <div 
        className={styles.inputImageThumbnail}
        onClick={() => {
          // 확대 모달 로직
        }}
      >
        <img src={pageImageUrl} alt="과외 페이지" />
      </div>
      <div className={styles.inputImageHint}>
        이미지를 보려면 여기를 클릭하세요! 👆
      </div>
    </div>
  )}
  
  {/* 입력창 */}
  <div className={styles.inputRow}>
    {/* 입력 필드와 전송 버튼 */}
  </div>
</div>
```

#### CSS:
```css
/* 입력 영역 컨테이너 */
.chatInputArea {
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid #e9eef6;
  z-index: 100;
}

/* 입력창 위 이미지 썸네일 영역 */
.imageThumbnailAboveInput {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e9eef6;
}

/* 썸네일 이미지 */
.inputImageThumbnail {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  border: 2px solid #e9eef6;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  flex-shrink: 0;
}

.inputImageThumbnail:hover {
  border-color: #2196f3;
  transform: scale(1.05);
}

.inputImageThumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* 텍스트 안내 */
.inputImageHint {
  font-size: 12px;
  color: #666;
  text-align: center;
  line-height: 1.4;
}

/* 모바일 */
@media (max-width: 768px) {
  .inputImageThumbnail {
    width: 40px;
    height: 40px;
  }
  .inputImageHint {
    font-size: 10px;
  }
  .imageThumbnailAboveInput {
    padding: 6px 12px;
    gap: 8px;
  }
}
```

### 방법 2: 입력창 옆에 작은 썸네일 (가로 배치)

#### 구조:
```tsx
<div className={styles.inputRow}>
  {pageImageUrl && (
    <div className={styles.imageThumbnailInInput}>
      {/* 썸네일 */}
      {/* 텍스트 */}
    </div>
  )}
  <input ... />
  <button ... />
</div>
```

## 📐 크기 비교

### 현재 (문제):
- 위치: 채팅 입력창 위
- 크기: max-height: 150px (매우 큼)
- 문제: 학습 내용을 가림

### 제안 (개선):
- 위치: 채팅 입력창 바로 위 (sticky)
- 크기: 50x50px (데스크톱) / 40x40px (모바일)
- 장점: 학습 내용을 거의 가리지 않음 (약 50px 높이만 차지)

## ✅ 장점

1. ✅ **항상 접근 가능**: 입력창 위에 sticky로 고정
2. ✅ **스크롤 불필요**: 채팅이 길어져도 입력창 근처에 있어서 접근 쉬움
3. ✅ **시각적 방해 최소화**: 작은 크기 (50px)로 학습 내용을 거의 가리지 않음
4. ✅ **명확한 안내**: 텍스트로 클릭 유도
5. ✅ **예쁜 배치**: 입력창과 정렬되어 깔끔함

## 🔄 Before vs After

### Before (현재):
```
[채팅 로그]
메시지...

[📷 큰 이미지 - 문제]
┌─────────────────┐
│   이미지        │ ← 150px 높이, 학습 내용 가림
│                 │
└─────────────────┘
"필요시 클릭해서 보세요! (업로드한 이미지) 👆"

[입력창]
```

### After (제안):
```
[채팅 로그]
메시지...
메시지...
메시지... ← 이제 방해받지 않음! ✅

[📷 작은 썸네일 - 개선]
┌─────┐
│ 📷  │ ← 50px 높이, 학습 내용을 거의 가리지 않음
└─────┘
"이미지를 보려면 여기를 클릭하세요! 👆"

[입력창]
```

## 🎯 최종 제안

**채팅 입력창 바로 위에 작은 썸네일 (50x50px) + 텍스트 안내**

- 위치: 입력창 바로 위 (sticky)
- 크기: 50x50px (데스크톱) / 40x40px (모바일)
- 배치: 중앙 정렬 또는 왼쪽 정렬 (예쁘게)
- 텍스트: "이미지를 보려면 여기를 클릭하세요! 👆"
- 기능: 클릭 시 확대 모달

