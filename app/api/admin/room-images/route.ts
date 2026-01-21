import { NextRequest, NextResponse } from 'next/server';

const LECTURE_API_BASE_URL = 
  process.env.LECTURE_API_BASE_URL || 
  'https://lecture-analysis-pipeline-api.seoltab.com/report-backend';

const PAGECALL_BASE_URL = 'https://api.pagecall.com/v1';

interface ImageTimelineItem {
  start: number; // 유닉스 타임스탬프
  end: number;   // 유닉스 타임스탬프
  src: string;   // 이미지 URL
}

interface TextItem {
  speaker: string;
  text: string;
  timestamp: number; // 유닉스 타임스탬프
}

interface MappedItem {
  imageUrl: string;
  timestamp: number; // 이미지의 start 타임스탬프
  texts: TextItem[]; // 해당 이미지와 매핑된 텍스트들
}

/**
 * POST /api/admin/room-images
 * Body: { roomId: string }
 * Response: { mappedItems: MappedItem[], uniqueImages: string[], roomId: string }
 * 
 * lecture-analysis-pipeline-api를 사용하여:
 * 1. 이미지 타임라인 가져오기 (image/{room_id})
 * 2. 텍스트 타임라인 가져오기 (text/{room_id})
 * 3. 유닉스 타임스탬프 기준으로 매핑
 * 4. 동일한 이미지는 한 번만 노출
 */
export async function POST(request: NextRequest) {
  try {
    const { roomId } = await request.json();

    if (!roomId || typeof roomId !== 'string') {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400 }
      );
    }

    // 병렬로 이미지와 텍스트 데이터 가져오기
    const [imageData, textData] = await Promise.all([
      fetchImageTimeline(roomId),
      fetchTextTimeline(roomId),
    ]);

    // 타임스탬프 기준으로 매핑
    const mappedItems = mapImagesToTexts(imageData, textData);

    // 동일한 이미지 URL은 한 번만 추출 (중복 제거)
    const uniqueImages = Array.from(
      new Set(mappedItems.map(item => item.imageUrl))
    );

    console.log(`[Room Images] Room ID: ${roomId}`);
    console.log(`  - 이미지 타임라인: ${imageData.length}개`);
    console.log(`  - 텍스트 아이템: ${textData.length}개`);
    console.log(`  - 매핑된 아이템: ${mappedItems.length}개`);
    console.log(`  - 고유 이미지: ${uniqueImages.length}개`);

    return NextResponse.json({
      mappedItems,      // 타임스탬프로 매핑된 데이터
      uniqueImages,     // 중복 제거된 이미지 URL 목록
      roomId,
      count: uniqueImages.length,
    });
  } catch (error: any) {
    console.error('room-images API error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * 이미지 타임라인 가져오기
 * 1. lecture-analysis-pipeline-api 우선 시도
 * 2. 실패하거나 데이터가 없으면 Pagecall API로 fallback
 */
async function fetchImageTimeline(roomId: string): Promise<ImageTimelineItem[]> {
  try {
    // 1. lecture-analysis-pipeline-api 시도
    const res = await fetch(
      `${LECTURE_API_BASE_URL}/image/${roomId}`,
      { headers: { accept: 'application/json' } }
    );

    if (res.ok) {
      const data = await res.json();
      
      // presigned_url이 있으면 다운로드
      if (data?.presigned_url) {
        const timelineRes = await fetch(data.presigned_url);
        if (timelineRes.ok) {
          const timelineData = await timelineRes.json();
          
          if (Array.isArray(timelineData) && timelineData.length > 0) {
            const result = timelineData
              .filter((item: any) => item && item.src && Number.isFinite(item.start) && Number.isFinite(item.end))
              .map((item: any) => ({
                start: Number(item.start),
                end: Number(item.end),
                src: String(item.src),
              }))
              .sort((a, b) => a.start - b.start);
            
            if (result.length > 0) {
              console.log(`[fetchImageTimeline] lecture-api에서 ${result.length}개 이미지 타임라인 가져옴`);
              return result;
            }
          }
        }
      }

      // 직접 배열로 응답이 오는 경우
      if (Array.isArray(data) && data.length > 0) {
        const result = data
          .filter((item: any) => item && item.src && Number.isFinite(item.start) && Number.isFinite(item.end))
          .map((item: any) => ({
            start: Number(item.start),
            end: Number(item.end),
            src: String(item.src),
          }))
          .sort((a, b) => a.start - b.start);
        
        if (result.length > 0) {
          console.log(`[fetchImageTimeline] lecture-api에서 ${result.length}개 이미지 타임라인 가져옴 (직접 배열)`);
          return result;
        }
      }
    }

    // 2. Fallback: Pagecall API로 이미지 가져오기
    console.log(`[fetchImageTimeline] lecture-api 실패 또는 데이터 없음, Pagecall API로 fallback`);
    return await fetchImagesFromPagecall(roomId);
  } catch (error) {
    console.error('[fetchImageTimeline] 에러:', error);
    // 에러 발생 시에도 Pagecall로 fallback 시도
    try {
      return await fetchImagesFromPagecall(roomId);
    } catch (fallbackError) {
      console.error('[fetchImageTimeline] Pagecall fallback도 실패:', fallbackError);
      return [];
    }
  }
}

/**
 * Pagecall API로 이미지 URL 목록 가져오기 (fallback)
 * 타임스탬프 정보가 없으므로 현재 시간을 기준으로 생성
 */
async function fetchImagesFromPagecall(roomId: string): Promise<ImageTimelineItem[]> {
  const token = process.env.PAGECALL_API_TOKEN;
  if (!token) {
    console.warn('[fetchImagesFromPagecall] PAGECALL_API_TOKEN이 설정되지 않았습니다.');
    return [];
  }

  try {
    const url = `${PAGECALL_BASE_URL}/rooms/${encodeURIComponent(roomId)}/pages?entity_type=Image`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[fetchImagesFromPagecall] Pagecall API 호출 실패: ${response.status}`);
      return [];
    }

    const data: any = await response.json();
    if (!data) {
      return [];
    }

    // 이미지 URL 추출
    const urls = extractImageUrlsFromPagecall(data);
    
    if (urls.length === 0) {
      console.log(`[fetchImagesFromPagecall] 이미지 URL을 찾을 수 없습니다.`);
      return [];
    }

    // 타임스탬프 정보가 없으므로 현재 시간 기준으로 생성
    // (실제로는 타임스탬프 매핑이 불가능하지만, 최소한 이미지는 표시)
    const now = Math.floor(Date.now() / 1000); // 유닉스 타임스탬프 (초)
    const result = urls.map((url, index) => ({
      start: now + index, // 순서대로 타임스탬프 할당 (실제 타임스탬프 아님)
      end: now + index + 1,
      src: url,
    }));

    console.log(`[fetchImagesFromPagecall] Pagecall에서 ${result.length}개 이미지 가져옴 (타임스탬프 정보 없음)`);
    return result;
  } catch (error) {
    console.error('[fetchImagesFromPagecall] 에러:', error);
    return [];
  }
}

/**
 * Pagecall 응답에서 이미지 URL 추출
 */
function extractImageUrlsFromPagecall(data: any): string[] {
  const urls = new Set<string>();

  // pages 배열이 있는 경우
  if (data.pages && Array.isArray(data.pages)) {
    for (const page of data.pages) {
      if (page.entities && Array.isArray(page.entities)) {
        for (const entity of page.entities) {
          if (entity.src && typeof entity.src === 'string') {
            try {
              const u = new URL(entity.src);
              if (isTargetImageUrl(u)) {
                urls.add(entity.src);
              }
            } catch (e) {
              // 유효하지 않은 URL은 무시
            }
          }
        }
      }
    }
  }
  
  // pages 구조가 없으면 재귀적으로 찾기
  if (urls.size === 0) {
    const walk = (node: any, depth: number = 0): void => {
      if (!node || depth > 10) return;
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (typeof node === 'object') {
        if ('src' in node && typeof node.src === 'string') {
          try {
            const u = new URL(node.src);
            if (isTargetImageUrl(u)) {
              urls.add(node.src);
            }
          } catch (e) {
            // 유효하지 않은 URL은 무시
          }
        }
        Object.values(node).forEach((value) => walk(value, depth + 1));
        return;
      }
    };
    walk(data);
  }

  return Array.from(urls);
}

/**
 * 교재 이미지로 사용할 수 있는 URL인지 판별
 */
function isTargetImageUrl(u: URL): boolean {
  if (u.protocol !== 'https:') return false;

  const hostname = u.hostname;
  const path = u.pathname;

  // 가이드 이미지는 항상 제외
  if (path.includes('/seoltab_guide/')) {
    return false;
  }

  // S3 이미지: amazonaws.com 도메인이고 s3. 포함
  if (hostname.includes('amazonaws.com') && hostname.includes('s3.')) {
    return true;
  }

  // 설탑 이미지 서버: a.seoltab.com 도메인
  if (hostname === 'a.seoltab.com' || hostname.includes('a.seoltab.com')) {
    return true;
  }

  return false;
}

/**
 * 텍스트 타임라인 가져오기
 * lecture-analysis-pipeline-api 사용 (기존 방식 유지)
 * presigned_url이 없거나 데이터가 없으면 빈 배열 반환
 */
async function fetchTextTimeline(roomId: string): Promise<TextItem[]> {
  try {
    const res = await fetch(
      `${LECTURE_API_BASE_URL}/text/${roomId}`,
      { headers: { accept: 'application/json' } }
    );

    if (!res.ok) {
      console.warn(`[fetchTextTimeline] 텍스트 API 호출 실패: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const presignedUrl = data?.presigned_url;

    if (presignedUrl) {
      const textRes = await fetch(presignedUrl);
      if (!textRes.ok) {
        console.warn(`[fetchTextTimeline] presigned URL 다운로드 실패: ${textRes.status}`);
        return [];
      }
      const rawText = await textRes.text();
      // NaN 값을 null로 변환
      const cleanedText = rawText.replace(/:\s*NaN\b/g, ': null');
      const jsonData = JSON.parse(cleanedText);

      if (Array.isArray(jsonData) && jsonData.length > 0) {
        const result = jsonData
          .map((conv: any) => {
            let speaker = 'unknown';
            let text = '';
            if (conv.user === 'teacher' || conv.user === 'T' || conv.speaker === 'teacher') {
              speaker = 'teacher';
              text = conv.teacher_text || conv.text || conv.content || conv.transcript || '';
            } else if (conv.user === 'student' || conv.user === 'S' || conv.speaker === 'student') {
              speaker = 'student';
              text = conv.student_text || conv.text || conv.content || conv.transcript || '';
            } else {
              speaker = conv.speaker || conv.role || 'unknown';
              text = conv.text || conv.content || conv.transcript || '';
            }

            const timestamp =
              typeof conv.start === 'number'
                ? conv.start
                : typeof conv.start_time === 'number'
                ? conv.start_time
                : typeof conv.startTime === 'number'
                ? conv.startTime
                : conv.timestamp || conv.time || null;

            return { speaker, text, timestamp: timestamp ? Number(timestamp) : null };
          })
          .filter((item: TextItem) => item.text && item.text.trim().length > 0 && item.timestamp !== null);
        
        if (result.length > 0) {
          console.log(`[fetchTextTimeline] ${result.length}개 텍스트 아이템 가져옴`);
          return result;
        }
      }
    }

    // 직접 배열로 응답이 오는 경우
    if (Array.isArray(data) && data.length > 0) {
      const result = data
        .map((conv: any) => {
          const timestamp =
            typeof conv.start === 'number'
              ? conv.start
              : typeof conv.start_time === 'number'
              ? conv.start_time
              : typeof conv.startTime === 'number'
              ? conv.startTime
              : conv.timestamp || conv.time || null;

          return {
            speaker: conv.speaker || conv.user || 'unknown',
            text: conv.text || conv.content || conv.transcript || '',
            timestamp: timestamp ? Number(timestamp) : null,
          };
        })
        .filter((item: TextItem) => item.text && item.text.trim().length > 0 && item.timestamp !== null);
      
      if (result.length > 0) {
        console.log(`[fetchTextTimeline] ${result.length}개 텍스트 아이템 가져옴 (직접 배열)`);
        return result;
      }
    }

    console.log(`[fetchTextTimeline] 텍스트 데이터 없음`);
    return [];
  } catch (error) {
    console.error('[fetchTextTimeline] 에러:', error);
    return [];
  }
}

/**
 * 이미지와 텍스트를 타임스탬프 기준으로 매핑
 */
function mapImagesToTexts(
  imageTimeline: ImageTimelineItem[],
  textTimeline: TextItem[]
): MappedItem[] {
  const mapped: MappedItem[] = [];

  for (const image of imageTimeline) {
    // 이미지의 start ~ end 범위에 포함되는 텍스트 찾기
    const matchingTexts = textTimeline.filter(
      (text) => text.timestamp >= image.start && text.timestamp <= image.end
    );

    mapped.push({
      imageUrl: image.src,
      timestamp: image.start,
      texts: matchingTexts,
    });
  }

  // 타임스탬프 순으로 정렬
  return mapped.sort((a, b) => a.timestamp - b.timestamp);
}


