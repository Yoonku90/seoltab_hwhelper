import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { generateSimpleToken } from '@/lib/token-utils';

/**
 * 🔐 학생 접근 토큰 API
 * 
 * POST /api/auth/token - 새 토큰 생성
 * GET /api/auth/token?token=xxx - 토큰으로 studentId 조회
 */

// 토큰 → studentId 매핑을 위한 컬렉션
async function getTokenCollection() {
  const { getDb } = await import('@/lib/db');
  const db = await getDb();
  return db.collection('access_tokens');
}

// POST: 새 토큰 생성
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentId, expiresInDays = 30 } = body;
    
    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }
    
    const col = await getTokenCollection();
    
    // 기존 유효한 토큰이 있으면 반환
    const existing = await col.findOne({ 
      studentId,
      expiresAt: { $gt: new Date() }
    });
    
    if (existing) {
      return NextResponse.json({
        success: true,
        token: existing.token,
        studentId,
        expiresAt: existing.expiresAt,
        accessUrl: `/home?token=${existing.token}`,
        message: '기존 토큰을 반환합니다.',
      });
    }
    
    // 새 토큰 생성
    const token = generateSimpleToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    await col.insertOne({
      token,
      studentId,
      createdAt: new Date(),
      expiresAt,
      lastUsedAt: null,
    });
    
    return NextResponse.json({
      success: true,
      token,
      studentId,
      expiresAt,
      accessUrl: `/home?token=${token}`,
      message: `✨ 토큰이 생성되었습니다! (${expiresInDays}일간 유효)`,
    });
    
  } catch (error) {
    console.error('[auth/token POST] Error:', error);
    return NextResponse.json({ error: '토큰 생성 실패' }, { status: 500 });
  }
}

// GET: 토큰으로 studentId 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }
    
    const col = await getTokenCollection();
    const tokenDoc = await col.findOne({ token });
    
    if (!tokenDoc) {
      return NextResponse.json({ 
        valid: false, 
        error: '유효하지 않은 토큰입니다.' 
      }, { status: 404 });
    }
    
    // 만료 확인
    if (tokenDoc.expiresAt && new Date() > tokenDoc.expiresAt) {
      return NextResponse.json({ 
        valid: false, 
        error: '만료된 토큰입니다. 새 링크를 요청하세요.' 
      }, { status: 401 });
    }
    
    // 마지막 사용 시간 업데이트
    await col.updateOne(
      { token },
      { $set: { lastUsedAt: new Date() } }
    );
    
    return NextResponse.json({
      valid: true,
      studentId: tokenDoc.studentId,
      expiresAt: tokenDoc.expiresAt,
    });
    
  } catch (error) {
    console.error('[auth/token GET] Error:', error);
    return NextResponse.json({ error: '토큰 조회 실패' }, { status: 500 });
  }
}

// DELETE: 토큰 삭제 (로그아웃)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 400 });
    }
    
    const col = await getTokenCollection();
    const result = await col.deleteOne({ token });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '토큰을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: '토큰이 삭제되었습니다.' });
    
  } catch (error) {
    console.error('[auth/token DELETE] Error:', error);
    return NextResponse.json({ error: '토큰 삭제 실패' }, { status: 500 });
  }
}

