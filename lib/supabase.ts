import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경변수 체크 로그
console.log('[Supabase] URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음');
console.log('[Supabase] Key:', supabaseAnonKey ? '✅ 설정됨' : '❌ 없음');

// Supabase 클라이언트 생성 (환경변수 없으면 null)
export const supabase: SupabaseClient | null = 
  supabaseUrl && supabaseAnonKey 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * 🖼️ Supabase Storage에 이미지 업로드
 * 
 * @param file - 파일 버퍼 또는 Blob
 * @param fileName - 저장할 파일명
 * @param bucket - 버킷 이름 (기본: 'images')
 * @returns 업로드된 이미지의 public URL
 */
export async function uploadImageToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  bucket: string = 'students_helper_image'
): Promise<{ url: string; path: string } | null> {
  // Supabase 클라이언트 체크
  if (!supabase) {
    console.error('[Supabase] 클라이언트가 초기화되지 않았습니다. 환경변수를 확인하세요.');
    return null;
  }

  try {
    // 고유한 파일명 생성
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const ext = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${timestamp}-${randomId}.${ext}`;
    const filePath = `uploads/${uniqueFileName}`;

    console.log('[Supabase] 업로드 시도:', { bucket, filePath, size: fileBuffer.length });

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[Supabase Upload Error]', error.message, error);
      return null;
    }

    console.log('[Supabase] 업로드 성공:', data);

    // Public URL 생성
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('[Supabase] Public URL:', urlData.publicUrl);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    console.error('[Supabase Upload Error]', error);
    return null;
  }
}

/**
 * 🗑️ Supabase Storage에서 이미지 삭제
 */
export async function deleteImageFromSupabase(
  filePath: string,
  bucket: string = 'students_helper_image'
): Promise<boolean> {
  if (!supabase) {
    console.error('[Supabase] 클라이언트가 초기화되지 않았습니다.');
    return false;
  }

  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('[Supabase Delete Error]', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Supabase Delete Error]', error);
    return false;
  }
}

