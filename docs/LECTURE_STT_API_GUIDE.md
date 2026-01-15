# Lecture STT API 가이드

이 문서는 seoltab_hwhelper에서 제공하는 Lecture STT 검색 API 사용법을 설명합니다.

## API 엔드포인트 목록

### 1. Room 검색 API

#### LVT로 검색
```
GET /api/lecture/search?lvt={lvt}
```

**요청 예시:**
```bash
curl "http://localhost:3000/api/lecture/search?lvt=12345"
```

**응답 예시:**
```json
{
  "search_type": "lvt",
  "search_value": "12345",
  "total_count": 3,
  "rooms": [
    {
      "room_id": "room_abc123",
      "lvt": "12345",
      "subject": "수학",
      "tutoring_datetime": "2024-01-15T10:00:00Z",
      "durations": 60,
      "is_stt": true,
      "text_aggregation": true,
      "cycle_state": "DONE"
    },
    ...
  ]
}
```

#### Room ID로 검색
```
GET /api/lecture/search?roomId={roomId}
```

**요청 예시:**
```bash
curl "http://localhost:3000/api/lecture/search?roomId=room_abc123"
```

**응답 예시:**
```json
{
  "search_type": "room_id",
  "search_value": "room_abc123",
  "total_count": 1,
  "rooms": [
    {
      "room_id": "room_abc123",
      "subject": "수학",
      "tutoring_datetime": "2024-01-15T10:00:00Z",
      "durations": 60,
      "is_stt": true,
      "text_aggregation": true,
      "cycle_state": "DONE"
    }
  ]
}
```

### 2. STT 텍스트 조회 API

#### 단일 Room ID로 조회 (GET)
```
GET /api/lecture/text?roomId={roomId}
```

**요청 예시:**
```bash
curl "http://localhost:3000/api/lecture/text?roomId=room_abc123"
```

#### 여러 Room ID로 배치 조회 (POST)
```
POST /api/lecture/text
Content-Type: application/json

{
  "room_ids": ["room_abc123", "room_def456", "room_ghi789"]
}
```

**요청 예시:**
```bash
curl -X POST "http://localhost:3000/api/lecture/text" \
  -H "Content-Type: application/json" \
  -d '{"room_ids": ["room_abc123", "room_def456"]}'
```

**응답 예시:**
```json
{
  "data": [
    {
      "room_id": "room_abc123",
      "subject": "수학",
      "presigned_url": "https://s3.amazonaws.com/...?signature=...",
      "text": null  // presigned_url이 있으면 text는 null
    },
    ...
  ]
}
```

**중요:** `presigned_url`이 있으면 해당 URL에서 직접 데이터를 다운로드해야 합니다.

## 사용 예시

### JavaScript/TypeScript

```typescript
// 1. LVT로 검색
async function searchByLvt(lvt: string) {
  const res = await fetch(`/api/lecture/search?lvt=${encodeURIComponent(lvt)}`);
  const data = await res.json();
  return data;
}

// 2. Room ID로 검색
async function searchByRoomId(roomId: string) {
  const res = await fetch(`/api/lecture/search?roomId=${encodeURIComponent(roomId)}`);
  const data = await res.json();
  return data;
}

// 3. STT 텍스트 가져오기
async function getSttText(roomId: string) {
  // API 호출
  const res = await fetch(`/api/lecture/text?roomId=${encodeURIComponent(roomId)}`);
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'STT 텍스트 조회 실패');
  }
  
  // presigned_url이 있으면 S3에서 데이터 로드
  if (data.data && data.data.length > 0) {
    const item = data.data[0];
    if (item.presigned_url) {
      const s3Res = await fetch(item.presigned_url);
      if (!s3Res.ok) throw new Error('S3 데이터 로드 실패');
      
      let text = await s3Res.text();
      
      // NaN 값을 null로 변환하는 전처리
      text = text
        .replace(/:\s*NaN\s*([,}])/g, ': null$1')
        .replace(/:\s*"NaN"\s*([,}])/g, ': null$1')
        .replace(/:\s*Infinity\s*([,}])/g, ': null$1')
        .replace(/:\s*-Infinity\s*([,}])/g, ': null$1');
      
      const jsonData = JSON.parse(text);
      
      // NaN 값 sanitize (재귀적으로 처리)
      const sanitizeNaNValues = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') {
          return obj;
        }
        
        if (Array.isArray(obj)) {
          return obj.map((item) => sanitizeNaNValues(item));
        }
        
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (
            typeof value === 'number' &&
            (isNaN(value) || !isFinite(value))
          ) {
            sanitized[key] = null;
          } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeNaNValues(value);
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      };
      
      return { ...item, text: sanitizeNaNValues(jsonData) };
    }
  }
  
  return data;
}

// 4. 배치로 여러 Room의 STT 텍스트 가져오기
async function getBatchSttText(roomIds: string[]) {
  const res = await fetch('/api/lecture/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_ids: roomIds }),
  });
  const data = await res.json();
  return data;
}
```

### Python

```python
import requests
import json
import re

BASE_URL = "http://localhost:3000"  # 또는 실제 서버 URL

def search_by_lvt(lvt: str):
    """LVT로 검색"""
    response = requests.get(f"{BASE_URL}/api/lecture/search", params={"lvt": lvt})
    response.raise_for_status()
    return response.json()

def search_by_room_id(room_id: str):
    """Room ID로 검색"""
    response = requests.get(f"{BASE_URL}/api/lecture/search", params={"roomId": room_id})
    response.raise_for_status()
    return response.json()

def sanitize_nan_values(obj):
    """NaN 값을 null로 변환"""
    if obj is None or not isinstance(obj, (dict, list)):
        return obj
    
    if isinstance(obj, list):
        return [sanitize_nan_values(item) for item in obj]
    
    sanitized = {}
    for key, value in obj.items():
        if isinstance(value, float) and (value != value or not value.is_finite()):
            sanitized[key] = None
        elif isinstance(value, (dict, list)):
            sanitized[key] = sanitize_nan_values(value)
        else:
            sanitized[key] = value
    return sanitized

def get_stt_text(room_id: str):
    """STT 텍스트 가져오기"""
    # API 호출
    response = requests.get(f"{BASE_URL}/api/lecture/text", params={"roomId": room_id})
    response.raise_for_status()
    data = response.json()
    
    # presigned_url이 있으면 S3에서 데이터 로드
    if data.get("data") and len(data["data"]) > 0:
        item = data["data"][0]
        if item.get("presigned_url"):
            s3_response = requests.get(item["presigned_url"])
            s3_response.raise_for_status()
            
            text = s3_response.text
            
            # NaN 값을 null로 변환하는 전처리
            text = re.sub(r':\s*NaN\s*([,}])', r': null\1', text)
            text = re.sub(r':\s*"NaN"\s*([,}])', r': null\1', text)
            text = re.sub(r':\s*Infinity\s*([,}])', r': null\1', text)
            text = re.sub(r':\s*-Infinity\s*([,}])', r': null\1', text)
            
            json_data = json.loads(text)
            item["text"] = sanitize_nan_values(json_data)
    
    return data

def get_batch_stt_text(room_ids: list):
    """배치로 여러 Room의 STT 텍스트 가져오기"""
    response = requests.post(
        f"{BASE_URL}/api/lecture/text",
        json={"room_ids": room_ids}
    )
    response.raise_for_status()
    return response.json()
```

## API 요약

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/lecture/search?lvt={lvt}` | GET | LVT로 Room 목록 검색 |
| `/api/lecture/search?roomId={roomId}` | GET | Room ID로 검색 |
| `/api/lecture/text?roomId={roomId}` | GET | 단일 Room의 STT 텍스트 조회 |
| `/api/lecture/text` | POST | 여러 Room의 STT 텍스트 배치 조회 |

## 주의사항

1. **presigned_url 처리**: STT 텍스트 조회 시 `presigned_url`이 있으면 해당 URL에서 직접 데이터를 다운로드해야 합니다.

2. **NaN 값 처리**: S3에서 받은 JSON 데이터에 NaN 값이 포함될 수 있으므로, 파싱 전에 전처리하거나 파싱 후 재귀적으로 처리해야 합니다.

3. **에러 처리**: API 호출 시 항상 에러 처리를 포함하세요.

4. **인코딩**: URL 파라미터는 `encodeURIComponent` 또는 `urllib.parse.quote`로 인코딩하세요.

## 외부 API 서버

이 API는 내부적으로 다음 외부 API 서버를 사용합니다:
- Base URL: `https://lecture-analysis-pipeline-api.seoltab.com/report-backend`
- 엔드포인트:
  - `GET /meta/lvt/{lvt}` - LVT로 Room 메타데이터 조회
  - `GET /meta/room/{room_id}` - Room ID로 메타데이터 조회
  - `POST /text/batch` - 배치로 STT 텍스트 조회

## 환경 변수

선택적으로 `.env.local`에 다음을 설정할 수 있습니다:
```
LECTURE_API_BASE_URL=https://lecture-analysis-pipeline-api.seoltab.com/report-backend
```

### 기본값 설명

- **기본값 (Default)**: `https://lecture-analysis-pipeline-api.seoltab.com/report-backend`
  - 환경 변수를 설정하지 않으면 이 URL이 자동으로 사용됩니다.
  - 이는 **설탭(Seoltab)의 Lecture Analysis Pipeline API 서버**입니다.

- **Base URL이란?**
  - 모든 API 요청의 기본 주소입니다.
  - 예: Base URL이 `https://lecture-analysis-pipeline-api.seoltab.com/report-backend`이면
    - LVT 검색: `https://lecture-analysis-pipeline-api.seoltab.com/report-backend/meta/lvt/{lvt}`
    - Room 검색: `https://lecture-analysis-pipeline-api.seoltab.com/report-backend/meta/room/{room_id}`
    - STT 텍스트: `https://lecture-analysis-pipeline-api.seoltab.com/report-backend/text/batch`

- **Seoltab API 사용 여부**
  - 네, **설탭(Seoltab)의 Lecture Analysis Pipeline API**를 사용합니다.
  - 도메인 `seoltab.com`에서 제공하는 수업 STT 데이터 조회 서비스입니다.

설정하지 않으면 기본값이 사용됩니다.

