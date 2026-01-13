# 데이터 0 상태에서 시작하는 전략 (Cold Start)

## 🎯 문제 상황

- 현재 학습 활동 데이터는 수집 중이지만, 점수 데이터는 0
- 코호트 분석이나 상관관계 분석을 하려면 충분한 데이터가 필요
- 하지만 학생들에게는 지금 당장 로드맵이 필요함

## ✅ 해결 방법: Cold Start 전략

### 방법 1: 교육 연구 데이터 활용 (즉시 가능) ⭐

#### 활용 가능한 데이터 소스:
1. **교육부/교육연구원 통계**
   - 국가 수준 학업성취도 평가 결과
   - 교육 통계 연보
   - 예: "영단어 학습 시간과 영어 점수 상승의 상관관계"

2. **학술 논문**
   - 교육학, 심리학 연구 논문
   - 메타 분석(Meta-analysis) 결과
   - 예: "어휘 학습이 영어 성적에 미치는 영향 연구"

3. **교육 업계 벤치마크**
   - 다른 학습 플랫폼의 공개된 통계
   - 교육 전문가의 경험치

#### 예시:
```
출처: 교육연구원 "어휘 학습과 영어 성적 상승 연구" (2023)
- 영단어 500개 학습: 평균 +5.2점 상승
- 영단어 1000개 학습: 평균 +10.5점 상승
- 영단어 2000개 학습: 평균 +18.3점 상승

→ 이 데이터를 활용하여 초기 로드맵 제공
```

### 방법 2: 전문가 추정치 활용

#### 개념:
- 교육 전문가(선생님, 교육 연구자)의 경험 기반 추정
- 일반적으로 알려진 교육 효과 활용

#### 예시:
```
[전문가 추정치]
- 영단어 1000개 외우기: +10점 (일반적인 경험치)
- 수학 문제 100개 풀기: +8~10점 (교육 전문가 추정)
- 문법 개념 5개 마스터: +6~8점 (교육 전문가 추정)

→ 명시: "교육 전문가 추정치 (실제 데이터 축적 중)"
```

### 방법 3: 점진적 데이터 교체 전략

#### Phase 1: 추정치 사용 (0~100명)
```
로드맵 표시:
"영단어 1000개 외우기 → 예상 점수 상승: +10점"
(출처: 교육 연구 데이터 / 전문가 추정치)
```

#### Phase 2: 하이브리드 (100~500명)
```
로드맵 표시:
"영단어 1000개 외우기 → 예상 점수 상승: +10점"
"우리 플랫폼 데이터: 87명 중 74명이 달성 (85% 성공률)"
(추정치 + 초기 통계 조합)
```

#### Phase 3: 실제 통계 (500명 이상)
```
로드맵 표시:
"영단어 1000개 외우기 → 평균 점수 상승: +10.5점"
"우리 플랫폼 데이터: 523명 중 445명이 달성 (85% 성공률)"
(실제 통계 데이터)
```

## 📊 초기 로드맵 예시 (추정치 기반)

### 영어:
```
🎯 점수 10점 올리기 로드맵

1. 영단어 1000개 외우기
   - 예상 점수 상승: +10점
   - 필요 시간: 하루 30개 × 33일
   - 출처: 교육 연구 데이터 (우리 플랫폼 데이터 축적 중)
```

### 수학:
```
🎯 점수 10점 올리기 로드맵

1. 문제 100개 풀기
   - 예상 점수 상승: +8~10점
   - 필요 시간: 하루 5개 × 20일
   - 출처: 교육 전문가 추정치 (우리 플랫폼 데이터 축적 중)
```

## 🔧 구현 방법

### 1. 추정치 데이터베이스 구축

```typescript
interface EstimatedRoadmap {
  subject: string;
  activity: string;
  targetCount: number;
  estimatedScoreImprovement: number;
  requiredTime: string;
  source: 'research' | 'expert' | 'benchmark';
  sourceDescription: string;
  confidence: 'high' | 'medium' | 'low';
}

// 예시 데이터
const estimatedRoadmaps: EstimatedRoadmap[] = [
  {
    subject: 'english',
    activity: 'vocabulary_study',
    targetCount: 1000,
    estimatedScoreImprovement: 10,
    requiredTime: '하루 30개 × 33일',
    source: 'research',
    sourceDescription: '교육연구원 "어휘 학습과 영어 성적 상승 연구" (2023)',
    confidence: 'high'
  },
  {
    subject: 'math',
    activity: 'problem_solve',
    targetCount: 100,
    estimatedScoreImprovement: 8,
    requiredTime: '하루 5개 × 20일',
    source: 'expert',
    sourceDescription: '교육 전문가 추정치',
    confidence: 'medium'
  }
];
```

### 2. 실제 통계와 병행 표시

```typescript
interface RoadmapItem {
  activity: string;
  targetCount: number;
  
  // 추정치 (항상 있음)
  estimatedScoreImprovement: number;
  estimatedSource: string;
  
  // 실제 통계 (데이터가 있으면)
  actualScoreImprovement?: number;
  actualSampleSize?: number;
  actualSuccessRate?: number;
  
  // 표시 우선순위
  displayMode: 'estimated' | 'hybrid' | 'actual';
}
```

### 3. UI에서 명확히 표시

```tsx
{roadmapItem.displayMode === 'estimated' && (
  <div>
    <span>예상 점수 상승: +{roadmapItem.estimatedScoreImprovement}점</span>
    <span className="source-badge">
      출처: {roadmapItem.estimatedSource}
      (우리 플랫폼 데이터 축적 중)
    </span>
  </div>
)}

{roadmapItem.displayMode === 'hybrid' && (
  <div>
    <span>예상 점수 상승: +{roadmapItem.estimatedScoreImprovement}점</span>
    <span className="actual-data">
      우리 플랫폼: {roadmapItem.actualSampleSize}명 중 
      {roadmapItem.actualSuccessRate}% 달성
    </span>
  </div>
)}

{roadmapItem.displayMode === 'actual' && (
  <div>
    <span>평균 점수 상승: +{roadmapItem.actualScoreImprovement}점</span>
    <span className="actual-data">
      우리 플랫폼 데이터: {roadmapItem.actualSampleSize}명 분석
    </span>
  </div>
)}
```

## ✅ 장점

1. **즉시 시작 가능**: 데이터가 없어도 로드맵 제공 가능
2. **신뢰성**: 교육 연구 데이터나 전문가 추정치 활용
3. **점진적 개선**: 데이터가 쌓이면 실제 통계로 교체
4. **투명성**: 출처를 명확히 표시하여 신뢰도 향상

## 🎯 결론

**데이터가 0인 상태에서도 시작 가능합니다!**

1. **초기**: 교육 연구 데이터나 전문가 추정치 활용
2. **중기**: 추정치 + 초기 통계 하이브리드
3. **장기**: 실제 통계 데이터로 완전 교체

이렇게 하면 학생들에게는 지금 당장 로드맵을 제공하면서, 동시에 데이터를 축적하여 점진적으로 정확도를 높일 수 있습니다.

