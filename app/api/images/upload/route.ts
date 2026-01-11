import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { Collections } from '@/lib/db';
import { ImageUpload } from '@/lib/types';
import { uploadImageToSupabase } from '@/lib/supabase';

// Supabase 사용 여부 (환경변수로 제어)
const USE_SUPABASE = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

// POST /api/images/upload - 이미지 업로드 (사진 촬영/업로드)
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const studentId = formData.get('studentId') as string;
    const assignmentId = formData.get('assignmentId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원하지 않는 이미지 형식입니다. (JPEG, PNG, WebP만 지원)' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      );
    }

    // 파일 버퍼로 변환
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    let imageUrl: string;
    let fileId: string;
    let storagePath: string | undefined;

    if (USE_SUPABASE) {
      // ☁️ Supabase Storage에 업로드
      const uploadResult = await uploadImageToSupabase(buffer, file.name);
      
      if (!uploadResult) {
        return NextResponse.json(
          { error: 'Supabase 업로드에 실패했습니다.' },
          { status: 500 }
        );
      }
      
      imageUrl = uploadResult.url;
      storagePath = uploadResult.path;
      fileId = uploadResult.path.split('/').pop()?.split('.')[0] || Date.now().toString();
      
      console.log('[Supabase] 이미지 업로드 완료:', imageUrl);
    } else {
      // 📁 로컬 파일 시스템에 저장 (Supabase 미설정 시)
      const UPLOAD_DIR = join(process.cwd(), 'uploads', 'images');
      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
      }

      fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${fileId}.${ext}`;
      const filePath = join(UPLOAD_DIR, fileName);

      await writeFile(filePath, buffer);
      imageUrl = `/api/images/${fileId}?ext=${ext}`;
      
      console.log('[Local] 이미지 업로드 완료:', imageUrl);
    }

    // 데이터베이스에 업로드 정보 저장
    const imageUpload: ImageUpload = {
      studentId,
      assignmentId: assignmentId || undefined,
      imageUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date(),
      analyzed: false,
      // Supabase 사용 시 스토리지 경로 저장
      ...(storagePath && { storagePath, storageType: 'supabase' as const }),
    };

    const uploads = await Collections.imageUploads();
    const result = await uploads.insertOne(imageUpload as any);

    return NextResponse.json({
      success: true,
      imageUpload: {
        ...imageUpload,
        _id: result.insertedId.toString(),
      },
      imageUploadId: result.insertedId.toString(),
      imageUrl,
      fileId,
      storageType: USE_SUPABASE ? 'supabase' : 'local',
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json(
      { error: '이미지를 업로드하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
