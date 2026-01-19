import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/admin/summaries/:id - 요약본 상세 조회
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const col = await Collections.reviewPrograms();
    const reviewProgram = await col.findOne({ _id: new ObjectId(id) } as any);
    if (!reviewProgram) {
      return NextResponse.json({ error: '요약본을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, summary: reviewProgram });
  } catch (error) {
    console.error('[admin/summaries/:id] 조회 오류:', error);
    return NextResponse.json(
      { error: '요약본을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/summaries/:id - 요약본 업데이트 (studentId 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { studentId } = body;
    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.reviewPrograms();
    const result = await col.updateOne(
      { _id: new ObjectId(id) } as any,
      { $set: { studentId } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: '요약본을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/summaries/:id] 업데이트 오류:', error);
    return NextResponse.json(
      { error: '요약본을 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/summaries/:id - 요약본 삭제
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const col = await Collections.reviewPrograms();
    const result = await col.deleteOne({ _id: new ObjectId(id) } as any);

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '요약본을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/summaries/:id] 삭제 오류:', error);
    return NextResponse.json(
      { error: '요약본을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

