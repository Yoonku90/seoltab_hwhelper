import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// GET /api/images/[id] - 이미지 파일 서빙
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fileId = params.id;
    const searchParams = req.nextUrl.searchParams;
    const ext = searchParams.get('ext') || 'jpg';

    const UPLOAD_DIR = join(process.cwd(), 'uploads', 'images');
    const extensions = [ext, 'jpg', 'jpeg', 'png', 'webp'];
    
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';
    let foundExt = '';

    // 여러 확장자 시도
    for (const extName of extensions) {
      const filePath = join(UPLOAD_DIR, `${fileId}.${extName}`);
      if (existsSync(filePath)) {
        imageBuffer = await readFile(filePath);
        foundExt = extName;
        if (extName === 'jpg' || extName === 'jpeg') mimeType = 'image/jpeg';
        else if (extName === 'png') mimeType = 'image/png';
        else if (extName === 'webp') mimeType = 'image/webp';
        break;
      }
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('이미지 서빙 오류:', error);
    return NextResponse.json(
      { error: '이미지를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
