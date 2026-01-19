import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  STEP1_HINT_PROMPT,
  STEP2_HINT_PROMPT,
  STEP3_HINT_PROMPT,
  STEP4_HINT_PROMPT,
} from '@/lib/prompts';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/problems/:id/help?step=1..4 - 단계별 힌트 제공
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: problemId } = await params;
    const searchParams = req.nextUrl.searchParams;
    const step = parseInt(searchParams.get('step') || '1');

    if (!ObjectId.isValid(problemId)) {
      return NextResponse.json(
        { error: '유효하지 않은 문제 ID입니다.' },
        { status: 400 }
      );
    }

    if (step < 1 || step > 4) {
      return NextResponse.json(
        { error: 'step은 1~4 사이여야 합니다.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }

    const problems = await Collections.problems();
    const problem = await problems.findOne({ _id: new ObjectId(problemId) } as any);

    if (!problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이전 힌트들 가져오기
    const helpSessions = await Collections.help_sessions();
    const previousHints = await helpSessions
      .find({
        problemId,
        studentId,
        step: { $lt: step },
      })
      .sort({ step: 1 })
      .toArray();

    // 프롬프트 선택
    let prompt = '';
    switch (step) {
      case 1:
        prompt = STEP1_HINT_PROMPT.replace(
          '{problemText}',
          problem.problemText || '문제 이미지를 확인해주세요.'
        );
        break;
      case 2:
        prompt = STEP2_HINT_PROMPT.replace(
          '{problemText}',
          problem.problemText || '문제 이미지를 확인해주세요.'
        )
          .replace(
            '{previousHint}',
            previousHints.find((h) => h.step === 1)?.hintText || ''
          );
        break;
      case 3:
        prompt = STEP3_HINT_PROMPT.replace(
          '{problemText}',
          problem.problemText || '문제 이미지를 확인해주세요.'
        )
          .replace(
            '{previousHints}',
            previousHints.map((h) => `${h.step}단계: ${h.hintText}`).join('\n\n')
          );
        break;
      case 4:
        prompt = STEP4_HINT_PROMPT.replace(
          '{problemText}',
          problem.problemText || '문제 이미지를 확인해주세요.'
        )
          .replace(
            '{previousHints}',
            previousHints.map((h) => `${h.step}단계: ${h.hintText}`).join('\n\n')
          );
        break;
    }

    // 이미지 URL 처리
    if (problem.imageUrl) {
      prompt = prompt.replace('{imageUrl}', problem.imageUrl);
    } else {
      prompt = prompt.replace('{imageUrl}', '');
    }

    // AI 호출
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    // 이미지가 있으면 함께 전송
    let parts: any[] = [];
    
    if (problem.imageUrl) {
      try {
        // imageUrl에서 파일 경로 추출
        // - 신규: /api/images/<fileId>?ext=png  (uploads/images)
        // - 레거시: /api/files/<fileId>...      (uploads/files)
        const urlObj = new URL(problem.imageUrl, req.nextUrl.origin);
        const pathnameLast = urlObj.pathname.split('/').pop() || '';
        const fileId =
          urlObj.searchParams.get('fileId') ||
          pathnameLast.split('.')[0] ||
          pathnameLast;
        
        if (fileId) {
          const isImagesRoute = urlObj.pathname.startsWith('/api/images/');
          const UPLOAD_DIR = join(process.cwd(), 'uploads', isImagesRoute ? 'images' : 'files');
          const preferredExt = (urlObj.searchParams.get('ext') || '').toLowerCase();
          const extensions = [
            preferredExt ? `.${preferredExt.replace(/^\./, '')}` : '',
            '.jpg',
            '.jpeg',
            '.png',
            '.webp',
            '.gif',
          ].filter(Boolean) as string[];
          let imageBuffer: Buffer | null = null;
          let mimeType = 'image/jpeg';

          for (const ext of extensions) {
            const filePath = join(UPLOAD_DIR, `${fileId}${ext}`);
            if (existsSync(filePath)) {
              imageBuffer = await readFile(filePath);
              if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
              else if (ext === '.png') mimeType = 'image/png';
              else if (ext === '.webp') mimeType = 'image/webp';
              else if (ext === '.gif') mimeType = 'image/gif';
              break;
            }
          }

          if (imageBuffer) {
            const base64Image = imageBuffer.toString('base64');
            parts.push({
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            });
          }
        }
      } catch (imageError) {
        console.error('이미지 로드 오류:', imageError);
        // 이미지 로드 실패해도 텍스트만으로 진행
      }
    }

    parts.push({ text: prompt });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = await result.response;
    const text = response.text();

    // JSON 파싱 시도
    let hintData: { hintTitle: string; hintText: string; nextAction?: string };
    try {
      // JSON 블록 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        hintData = JSON.parse(jsonMatch[0]);
      } else {
        // JSON이 아니면 전체 텍스트를 hintText로 사용
        hintData = {
          hintTitle: `${step}단계 힌트`,
          hintText: text,
          nextAction: step < 4 ? '다음 단계로 넘어가시겠어요?' : '완료되었습니다!',
        };
      }
    } catch (parseError) {
      // 파싱 실패 시 전체 텍스트 사용
      hintData = {
        hintTitle: `${step}단계 힌트`,
        hintText: text,
        nextAction: step < 4 ? '다음 단계로 넘어가시겠어요?' : '완료되었습니다!',
      };
    }

    // 힌트 세션 저장
    const helpSession = {
      problemId,
      assignmentId: problem.assignmentId,
      studentId,
      step: step as 1 | 2 | 3 | 4,
      problemText: problem.problemText,
      imageUrl: problem.imageUrl,
      hintTitle: hintData.hintTitle,
      hintText: hintData.hintText,
      nextAction: hintData.nextAction,
      createdAt: new Date(),
    };

    await helpSessions.insertOne(helpSession);

    return NextResponse.json({
      step,
      hintTitle: hintData.hintTitle,
      hintText: hintData.hintText,
      nextAction: hintData.nextAction,
    });
  } catch (error) {
    console.error('힌트 생성 오류:', error);
    return NextResponse.json(
      { error: '힌트를 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

