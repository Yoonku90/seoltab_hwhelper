import { NextRequest, NextResponse } from 'next/server';

const PAGECALL_BASE_URL = 'https://api.pagecall.com/v1';

/**
 * GET /api/admin/room-images/debug?roomId=xxx
 * Pagecall API 응답 구조 전체를 확인 (view time 등 메타데이터 확인용)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId query parameter is required' },
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

    const url = `${PAGECALL_BASE_URL}/rooms/${encodeURIComponent(roomId)}/pages?entity_type=Image`;

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

    // 응답 전체 구조 분석
    const analysis = {
      hasPages: Array.isArray(data.pages),
      pagesCount: Array.isArray(data.pages) ? data.pages.length : 0,
      firstPageStructure: Array.isArray(data.pages) && data.pages.length > 0 ? {
        keys: Object.keys(data.pages[0]),
        hasEntities: Array.isArray(data.pages[0].entities),
        entitiesCount: Array.isArray(data.pages[0].entities) ? data.pages[0].entities.length : 0,
        firstEntityKeys: Array.isArray(data.pages[0].entities) && data.pages[0].entities.length > 0 
          ? Object.keys(data.pages[0].entities[0]) 
          : [],
        // view time 관련 필드 확인
        hasViewTime: 'viewTime' in (data.pages[0] || {}),
        hasView_time: 'view_time' in (data.pages[0] || {}),
        hasDuration: 'duration' in (data.pages[0] || {}),
        hasViewDuration: 'viewDuration' in (data.pages[0] || {}),
        // 첫 번째 엔티티에서 view time 확인
        firstEntityViewTime: Array.isArray(data.pages[0].entities) && data.pages[0].entities.length > 0
          ? {
              hasViewTime: 'viewTime' in (data.pages[0].entities[0] || {}),
              hasView_time: 'view_time' in (data.pages[0].entities[0] || {}),
              hasDuration: 'duration' in (data.pages[0].entities[0] || {}),
              hasViewDuration: 'viewDuration' in (data.pages[0].entities[0] || {}),
              allKeys: Object.keys(data.pages[0].entities[0] || {}),
            }
          : null,
      } : null,
      // 전체 응답 키 확인
      topLevelKeys: Object.keys(data),
      // 전체 응답 (최대 5000자)
      fullResponse: JSON.stringify(data, null, 2).substring(0, 5000),
    };

    return NextResponse.json({
      roomId,
      analysis,
      fullResponse: data, // 전체 응답도 포함
    });
  } catch (error: any) {
    console.error('room-images debug API error:', error);
    return NextResponse.json(
      {
        error: error?.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

