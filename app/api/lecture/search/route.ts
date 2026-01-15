import { NextRequest, NextResponse } from 'next/server';

// Lecture Analysis Pipeline API Base URL
const LECTURE_API_BASE_URL = 
  process.env.LECTURE_API_BASE_URL || 
  'https://lecture-analysis-pipeline-api.seoltab.com/report-backend';

/**
 * LVT, Room ID, 또는 User ID로 검색
 * GET /api/lecture/search?lvt={lvt} 또는 ?roomId={roomId} 또는 ?userId={userId}
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const lvt = searchParams.get('lvt');
    const roomId = searchParams.get('roomId');
    const userId = searchParams.get('userId');

    const searchTypes = [lvt, roomId, userId].filter(Boolean);
    
    if (searchTypes.length === 0) {
      return NextResponse.json(
        { error: 'LVT, Room ID, 또는 User ID 중 하나를 제공해야 합니다.' },
        { status: 400 }
      );
    }

    if (searchTypes.length > 1) {
      return NextResponse.json(
        { error: 'LVT, Room ID, User ID 중 하나만 제공할 수 있습니다.' },
        { status: 400 }
      );
    }

    let result;

    if (lvt) {
      // LVT로 검색 - /meta/lvt/{lvt}를 호출하여 room 메타데이터 가져오기
      const response = await fetch(`${LECTURE_API_BASE_URL}/meta/lvt/${lvt}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { 
            error: errorData.detail || `LVT 검색 실패: ${response.status} ${response.statusText}` 
          },
          { status: response.status }
        );
      }

      const metaData = await response.json();
      
      // rooms 배열에 lvt 추가
      const rooms = (metaData.rooms || []).map((room: any) => ({
        ...room,
        lvt: lvt,
      }));
      
      result = {
        search_type: 'lvt',
        search_value: lvt,
        total_count: rooms.length,
        rooms: rooms,
      };
    } else if (roomId) {
      // Room ID로 검색 - /meta/room/{room_id}를 호출하여 room 메타데이터 확인
      try {
        const response = await fetch(`${LECTURE_API_BASE_URL}/meta/room/${roomId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // room이 없으면 빈 배열 반환
          return NextResponse.json({
            search_type: 'room_id',
            search_value: roomId,
            total_count: 0,
            rooms: [],
          });
        }

        const metaData = await response.json();
        
        result = {
          search_type: 'room_id',
          search_value: roomId,
          total_count: 1,
          rooms: [metaData],
        };
      } catch (error) {
        // 에러 발생 시 빈 배열 반환
        return NextResponse.json({
          search_type: 'room_id',
          search_value: roomId,
          total_count: 0,
          rooms: [],
        });
      }
    } else if (userId) {
      // User ID로 검색 - /meta/user/{user_id}를 호출하여 user의 room 목록 가져오기
      try {
        const response = await fetch(`${LECTURE_API_BASE_URL}/meta/user/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          // 404면 빈 배열 반환
          if (response.status === 404) {
            return NextResponse.json({
              search_type: 'user_id',
              search_value: userId,
              total_count: 0,
              rooms: [],
            });
          }
          return NextResponse.json(
            { 
              error: errorData.detail || `User ID 검색 실패: ${response.status} ${response.statusText}` 
            },
            { status: response.status }
          );
        }

        const metaData = await response.json();
        
        // 응답이 rooms 배열이거나 단일 객체일 수 있음
        const rooms = Array.isArray(metaData.rooms) 
          ? metaData.rooms 
          : metaData.room 
          ? [metaData.room]
          : metaData
          ? [metaData]
          : [];
        
        result = {
          search_type: 'user_id',
          search_value: userId,
          total_count: rooms.length,
          rooms: rooms.map((room: any) => ({
            ...room,
            user_id: userId,
          })),
        };
      } catch (error) {
        // 에러 발생 시 빈 배열 반환
        return NextResponse.json({
          search_type: 'user_id',
          search_value: userId,
          total_count: 0,
          rooms: [],
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[lecture/search] Error:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

