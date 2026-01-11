import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET: 토큰 목록 (학생 이름 포함)
export async function GET() {
  try {
    const db = await getDb();
    
    // 토큰 목록
    const tokens = await db.collection('access_tokens')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // 학생 이름 조회
    const studentIds = [...new Set(tokens.map(t => t.studentId))];
    const students = await db.collection('students')
      .find({ studentId: { $in: studentIds } })
      .project({ studentId: 1, name: 1 })
      .toArray();
    
    const studentNameMap: Record<string, string> = {};
    for (const s of students) {
      studentNameMap[s.studentId] = s.name;
    }

    // 학생 이름 포함
    const tokensWithNames = tokens.map(t => ({
      ...t,
      studentName: studentNameMap[t.studentId] || null,
    }));

    return NextResponse.json({ tokens: tokensWithNames });
  } catch (error) {
    console.error('[admin/tokens GET] Error:', error);
    return NextResponse.json({ error: '토큰 목록 조회 실패' }, { status: 500 });
  }
}

// DELETE: 토큰 삭제
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 });
    }

    const db = await getDb();
    const result = await db.collection('access_tokens').deleteOne({
      _id: new ObjectId(id),
    });

    return NextResponse.json({
      success: true,
      deleted: result.deletedCount,
    });
  } catch (error) {
    console.error('[admin/tokens DELETE] Error:', error);
    return NextResponse.json({ error: '토큰 삭제 실패' }, { status: 500 });
  }
}

