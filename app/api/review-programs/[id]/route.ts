import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

// GET /api/review-programs/:id - 단일 복습 프로그램 조회
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
    const doc = await col.findOne({ _id: new ObjectId(id) } as any);

    if (!doc) {
      return NextResponse.json({ error: '복습 프로그램을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, reviewProgram: doc });
  } catch (error) {
    console.error('복습 프로그램 조회 오류:', error);
    return NextResponse.json(
      { error: '복습 프로그램을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PATCH /api/review-programs/:id - 복습 프로그램 업데이트 (studentId 등)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: '유효하지 않은 ID입니다.' }, { status: 400 });
    }

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.reviewPrograms();
    const result = await col.updateOne(
      { _id: new ObjectId(id) } as any,
      { 
        $set: { 
          studentId,
          updatedAt: new Date(),
        } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: '복습 프로그램을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '복습 프로그램이 업데이트되었습니다.' });
  } catch (error) {
    console.error('복습 프로그램 업데이트 오류:', error);
    return NextResponse.json(
      { error: '복습 프로그램을 업데이트하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/review-programs/:id - 복습 프로그램 삭제
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
      return NextResponse.json({ error: '복습 프로그램을 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '복습 프로그램이 삭제되었습니다.' });
  } catch (error) {
    console.error('복습 프로그램 삭제 오류:', error);
    return NextResponse.json(
      { error: '복습 프로그램을 삭제하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


