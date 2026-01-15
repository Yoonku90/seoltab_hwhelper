import { NextRequest, NextResponse } from 'next/server';

// Lecture Analysis Pipeline API Base URL
const LECTURE_API_BASE_URL = 
  process.env.LECTURE_API_BASE_URL || 
  'https://lecture-analysis-pipeline-api.seoltab.com/report-backend';

/**
 * Room ID로 STT 텍스트 데이터 조회
 * POST /api/lecture/text
 * Body: { room_ids: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room_ids } = body;

    if (!room_ids || !Array.isArray(room_ids) || room_ids.length === 0) {
      return NextResponse.json(
        { error: 'room_ids 배열을 제공해야 합니다.' },
        { status: 400 }
      );
    }

    // 배치로 세션 텍스트 데이터 조회
    const response = await fetch(`${LECTURE_API_BASE_URL}/text/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ room_ids }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { 
          error: errorData.detail || `텍스트 조회 실패: ${response.status} ${response.statusText}` 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[lecture/text] Error:', error);
    return NextResponse.json(
      { error: '텍스트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * 단일 Room ID로 STT 텍스트 데이터 조회
 * GET /api/lecture/text?roomId={roomId}
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId를 제공해야 합니다.' },
        { status: 400 }
      );
    }

    // POST 엔드포인트 재사용
    return POST(
      new NextRequest(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify({ room_ids: [roomId] }),
      })
    );
  } catch (error) {
    console.error('[lecture/text] Error:', error);
    return NextResponse.json(
      { error: '텍스트 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

