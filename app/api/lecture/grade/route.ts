import { NextRequest, NextResponse } from 'next/server';
import { getGradeByUserNo } from '@/lib/student-grade-matcher';
import { getKSTYear } from '@/lib/time-utils';

type GradeLookupResponse = {
  roomId: string;
  studentId: string | null;
  studentName: string | null;
  studentNickname: string | null;
  sessionYear: number | null;
  sessionGrade: string | null;
  currentGrade: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId가 필요합니다.' }, { status: 400 });
    }

    const pagecallToken = process.env.PAGECALL_API_TOKEN;
    if (!pagecallToken) {
      return NextResponse.json(
        { error: 'PAGECALL_API_TOKEN이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const sessionsRes = await fetch(`https://api.pagecall.com/v1/rooms/${roomId}/sessions`, {
      headers: {
        Authorization: `Bearer ${pagecallToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sessionsRes.ok) {
      return NextResponse.json(
        { error: `Pagecall API 호출 실패: ${sessionsRes.status}` },
        { status: 502 }
      );
    }

    const sessionsData = await sessionsRes.json();

    let sessionYear: number | null = null;
    if (Array.isArray(sessionsData.sessions) && sessionsData.sessions.length > 0) {
      const firstSession = sessionsData.sessions[0];
      const dateStr = firstSession.connected_at || firstSession.disconnected_at;
      if (dateStr) {
        sessionYear = getKSTYear(dateStr);
      }
    }

    let studentId: string | null = null;
    let studentName: string | null = null;
    let studentNickname: string | null = null;

    if (Array.isArray(sessionsData.sessions)) {
      for (const session of sessionsData.sessions) {
        if (!session.user_id || typeof session.user_id !== 'string') continue;

        const studentMatch = session.user_id.match(/^(.+?)\(S_(\d+)\)$/);
        if (studentMatch) {
          studentName = studentMatch[1].trim();
          studentId = studentMatch[2];
          break;
        }

        const simpleStudentMatch = session.user_id.match(/S_(\d+)/);
        if (simpleStudentMatch) {
          studentId = simpleStudentMatch[1];
        }
      }
    }

    if (studentName && studentName.length >= 2) {
      studentNickname = studentName.slice(-2);
    }

    const sessionGrade = studentId ? await getGradeByUserNo(studentId, sessionYear) : null;
    const currentGrade = studentId ? await getGradeByUserNo(studentId, null) : null;

    return NextResponse.json({
      roomId,
      studentId,
      studentName,
      studentNickname,
      sessionYear,
      sessionGrade,
      currentGrade,
    } satisfies GradeLookupResponse);
  } catch (error: any) {
    console.error('[lecture/grade] Error:', error?.message || error);
    return NextResponse.json({ error: '학년 자동 조회 실패' }, { status: 500 });
  }
}

