import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const BUCKET_NAME = 'students_helper_image';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    if (body.confirm !== 'DELETE_STORAGE') {
      return NextResponse.json({ error: '확인 문구가 필요합니다.' }, { status: 400 });
    }

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 버킷 내 모든 파일 목록 가져오기
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list('uploads', { limit: 1000 });

    if (listError) {
      console.error('[clear-storage] List error:', listError);
      return NextResponse.json({ error: '파일 목록 조회 실패' }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: '✅ 삭제할 파일이 없습니다.',
        deletedCount: 0,
      });
    }

    // 파일 삭제
    const filePaths = files.map(f => `uploads/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(filePaths);

    if (deleteError) {
      console.error('[clear-storage] Delete error:', deleteError);
      return NextResponse.json({ error: '파일 삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `✅ ${files.length}개 파일 삭제됨`,
      deletedCount: files.length,
    });
  } catch (error) {
    console.error('[admin/clear-storage] Error:', error);
    return NextResponse.json({ error: 'Storage 삭제 실패' }, { status: 500 });
  }
}

// GET: Storage 현황
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase가 설정되지 않았습니다.' }, { status: 500 });
    }

    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('uploads', { limit: 1000 });

    if (error) {
      return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    }

    const totalSize = files?.reduce((sum, f) => sum + (f.metadata?.size || 0), 0) || 0;

    return NextResponse.json({
      fileCount: files?.length || 0,
      totalSize,
      totalSizeFormatted: formatBytes(totalSize),
    });
  } catch (error) {
    console.error('[admin/clear-storage GET] Error:', error);
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

