import { NextRequest, NextResponse } from 'next/server';

const PAGECALL_BASE_URL = 'https://api.pagecall.com/v1';

/**
 * POST /api/admin/room-images
 * Body: { roomId: string }
 * Response: { urls: string[], roomId: string }
 * 
 * Pagecall rooms/{roomId}/pages?entity_type=Image 를 호출해서
 * 이미지 URL 목록만 추려서 반환한다.
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

    const token = process.env.PAGECALL_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'PAGECALL_API_TOKEN is not configured on the server' },
        { status: 500 }
      );
    }

    const url = `${PAGECALL_BASE_URL}/rooms/${encodeURIComponent(
      roomId
    )}/pages?entity_type=Image`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Failed to fetch from Pagecall',
          status: response.status,
          statusText: response.statusText,
          body: text,
        },
        { status: 502 }
      );
    }

    const data: any = await response.json().catch(() => null);

    if (!data) {
      return NextResponse.json(
        { error: 'Invalid JSON from Pagecall' },
        { status: 502 }
      );
    }

    // 다양한 응답 형태를 대응하기 위한 유연한 URL 추출 로직
    const urls = extractImageUrls(data);

    console.log(`[Room Images] Room ID: ${roomId}, 추출된 URL 수: ${urls.length}`);

    return NextResponse.json({ 
      urls,
      roomId,
      count: urls.length
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
 * 교재 이미지로 사용할 수 있는 URL인지 판별
 * - S3 이미지 (amazonaws.com)
 * - 설탑 이미지 서버 (a.seoltab.com)
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
 * Pagecall 응답에서 이미지 URL 추출 (S3 + a.seoltab.com)
 * 구조: pages[].entities[].src
 */
function extractImageUrls(data: any): string[] {
  const urls = new Set<string>();

  // pages 배열이 있는 경우 (일반적인 Pagecall 응답 구조)
  if (data.pages && Array.isArray(data.pages)) {
    for (const page of data.pages) {
      if (page.entities && Array.isArray(page.entities)) {
        for (const entity of page.entities) {
          // entity.src 필드에서 이미지 URL 추출
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
  
  // pages 구조가 없으면 재귀적으로 찾기 (fallback)
  if (urls.size === 0) {
    const walk = (node: any, depth: number = 0): void => {
      if (!node || depth > 10) return; // 깊이 제한
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item, depth + 1));
        return;
      }
      if (typeof node === 'object') {
        // src 필드 우선 체크
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
        // 다른 필드들도 재귀적으로 순회
        Object.values(node).forEach((value) => walk(value, depth + 1));
        return;
      }
    };
    walk(data);
  }

  return Array.from(urls);
}

