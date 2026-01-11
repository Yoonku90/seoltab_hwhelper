import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

function guessSubjectFromText(text: string): string {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return '미분류';

  // 영어 신호 (먼저 체크 - 영어 문법 키워드가 있으면 영어로 판단)
  if (
    /\b(choose|circle|fill in|blank|grammar|sentence|subject|object|verb|adjective|adverb|present|past|future|tense|infinitive|gerund|participle|clause|phrase|preposition|conjunction|article|noun|pronoun|modal|auxiliary)\b/i.test(t) ||
    /\b(look|feel|smell|taste|sound|seem|appear|become|get|grow|turn|remain|stay|keep)\b/i.test(t) || // 감각동사/연결동사
    /\b(give|send|show|tell|teach|make|buy|get|bring|pass|lend|offer|promise|write|read|ask)\b/i.test(t) || // 수여동사
    /\b(active|passive|voice|direct|indirect|complement|modifier)\b/i.test(t) || // 문법 용어
    /감각동사|수여동사|지각동사|사역동사|to부정사|동명사|분사|관계대명사|관계부사|접속사|전치사|형용사|부사|명사|동사/i.test(t) ||
    /영어|문법|독해|해석|영문법|구문/i.test(t) ||
    /unit\s*\d+|lesson\s*\d+/i.test(t) // Unit 01, Lesson 1 등
  ) {
    return '영어';
  }
  // 수학 신호
  if (
    /\\frac|\\sqrt|\\sum|\\int|그래프|좌표|방정식|부등식|미분|적분|확률|통계|함수|도형|이차|일차|기울기|절편|항등식|나머지정리|인수분해|다항식|몫|나눗셈|조립제법|근|해|계수|차수|등식|정리|공식|증명|연립|행렬|벡터|수열|급수|로그|지수|삼각함수|sin|cos|tan|lim|극한/.test(t)
  ) {
    return '수학';
  }
  // 국어 신호
  if (/국어|문학|화자|시점|주제|표현|품사|서술어|형태소|어휘|비문학|운문|산문|소설|시/.test(t)) {
    return '국어';
  }
  // 사회/과학(거친 휴리스틱)
  if (/과학|물리|화학|생명|지구|실험|에너지|전류|원소|분자/.test(t)) return '과학';
  if (/사회|역사|지리|정치|경제|헌법|민주|산업|무역/.test(t)) return '사회';

  return '미분류';
}

// POST /api/images/analyze - 이미지 분석 (OCR + 문제 인식)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUploadId, studentId } = body;

    if (!imageUploadId) {
      return NextResponse.json(
        { error: 'imageUploadId가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(imageUploadId)) {
      return NextResponse.json(
        { error: '유효하지 않은 이미지 업로드 ID입니다.' },
        { status: 400 }
      );
    }

    const imageUploads = await Collections.imageUploads();
    const imageUpload = await imageUploads.findOne({
      _id: new ObjectId(imageUploadId),
    } as any);

    if (!imageUpload) {
      return NextResponse.json(
        { error: '이미지를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 이미 분석된 경우
    if (imageUpload.analyzed && imageUpload.analysis) {
      return NextResponse.json({
        success: true,
        analysis: imageUpload.analysis,
        imageUpload,
      });
    }

    // 이미지 파일 읽기
    const imageUrlStr = imageUpload.imageUrl;
    let imageBuffer: Buffer | null = null;
    let mimeType = 'image/jpeg';

    // ☁️ Supabase URL인 경우 (https://...supabase.co/...)
    if (imageUrlStr.startsWith('https://') && imageUrlStr.includes('supabase.co')) {
      console.log('[Analyze] Supabase 이미지 가져오기:', imageUrlStr);
      try {
        const response = await fetch(imageUrlStr);
        if (!response.ok) {
          throw new Error(`Supabase 이미지 가져오기 실패: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        
        // Content-Type에서 mimeType 추출
        const contentType = response.headers.get('content-type');
        if (contentType) {
          mimeType = contentType;
        }
        console.log('[Analyze] Supabase 이미지 로드 성공:', imageBuffer.length, 'bytes');
      } catch (fetchError) {
        console.error('[Analyze] Supabase 이미지 가져오기 실패:', fetchError);
        return NextResponse.json(
          { error: '클라우드 이미지를 가져올 수 없습니다.' },
          { status: 500 }
        );
      }
    } else {
      // 📁 로컬 파일인 경우
      let storedFileId: string | null = null;
      let preferredExt = '';
      
      try {
        if (imageUrlStr.startsWith('http://') || imageUrlStr.startsWith('https://')) {
          const urlObj = new URL(imageUrlStr);
          storedFileId = urlObj.pathname.split('/').pop() || null;
          preferredExt = (urlObj.searchParams.get('ext') || '').toLowerCase();
        } else {
          const urlObj = new URL(imageUrlStr, req.nextUrl.origin);
          storedFileId = urlObj.pathname.split('/').pop() || null;
          preferredExt = (urlObj.searchParams.get('ext') || '').toLowerCase();
        }
      } catch (urlError) {
        console.error('URL 파싱 오류:', urlError, 'imageUrl:', imageUpload.imageUrl);
        const match = imageUpload.imageUrl.match(/\/api\/images\/([^?]+)/);
        if (match) {
          storedFileId = match[1];
          const extMatch = imageUpload.imageUrl.match(/[?&]ext=([^&]+)/);
          if (extMatch) preferredExt = extMatch[1].toLowerCase();
        }
      }

      if (!storedFileId) {
        return NextResponse.json(
          { error: '이미지 경로에서 파일 ID를 추출할 수 없습니다.' },
          { status: 500 }
        );
      }

      const UPLOAD_DIR = join(process.cwd(), 'uploads', 'images');
      const candidateExts = [
        preferredExt ? `.${preferredExt.replace(/^\./, '')}` : '',
        '.jpg',
        '.jpeg',
        '.png',
        '.webp',
      ].filter(Boolean);

      for (const ext of candidateExts) {
        const filePath = join(UPLOAD_DIR, `${storedFileId}${ext}`);
        if (existsSync(filePath)) {
          imageBuffer = await readFile(filePath);
          if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
          else if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.webp') mimeType = 'image/webp';
          break;
        }
      }
    }

    if (!imageBuffer) {
      console.error('이미지 파일을 찾을 수 없습니다:', {
        imageUrl: imageUpload.imageUrl,
      });
      return NextResponse.json(
        { 
          error: '이미지 파일을 찾을 수 없습니다.',
          debug: process.env.NODE_ENV !== 'production' ? {
            imageUrl: imageUpload.imageUrl,
          } : undefined,
        },
        { status: 404 }
      );
    }

    // AI로 이미지 분석 (OCR + 문제 인식)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // 이미지 분석, OCR, 문제 인식은 2.5 pro 사용 (정확도 중요)
    // JSON 모드가 비어오는 환경이 있을 수 있어 text 모드 폴백도 둠
    const modelJson = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });
    const modelText = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
    });

    const base64Image = imageBuffer.toString('base64');
    
    // 디버그: 이미지가 제대로 전달되는지 확인
    if (process.env.NODE_ENV !== 'production') {
      console.log('이미지 분석 시작:', {
        imageUploadId,
        imageUrl: imageUpload.imageUrl,
        imageSize: imageBuffer.length,
        base64Length: base64Image.length,
        mimeType,
      });
    }
    
    const prompt = `
이 이미지는 교재나 문제집 페이지입니다. 다음을 분석해주세요:

1. 이미지에서 텍스트를 모두 추출하세요 (OCR)
2. 문제가 몇 개 있는지 찾아주세요
3. 각 문제의 번호와 내용을 식별해주세요
4. 과목이 무엇인지 판단해주세요 (수학, 영어, 국어 등)
5. 페이지 번호가 있다면 알려주세요
6. (중요!) 학생이 표시한 마커를 찾아주세요:
   - 별표(★, ☆, *) 표시된 문제
   - 체크(✓, ✔, V) 표시된 문제
   - 밑줄 또는 하이라이트된 부분
   - 동그라미(○)로 표시된 부분
   - 물음표(?) 표시된 문제 (모르겠다는 표시)
   - X 표시된 문제 (틀린 문제)
   - 손글씨 메모나 풀이 흔적

반드시 아래 JSON만 출력하세요. 다른 텍스트/설명/코드펜스(예: \`\`\`)를 절대로 붙이지 마세요.
{
  "extractedText": "전체 텍스트 내용",
  "subject": "과목명",
  "pageNumber": 페이지번호 또는 null,
  "recognizedProblems": [
    {
      "number": 문제번호,
      "text": "문제 내용 (가능한 만큼)",
      "position": {
        "x": x좌표(이미지에서의 비율 0-1),
        "y": y좌표(이미지에서의 비율 0-1),
        "width": 너비(이미지에서의 비율 0-1),
        "height": 높이(이미지에서의 비율 0-1)
      }
    }
  ],
  "priorityMarkers": [
    {
      "type": "star|check|underline|circle|highlight|question_mark|x_mark|handwriting",
      "problemNumber": 해당 문제 번호 또는 null,
      "description": "마커에 대한 설명 (예: 1번 문제에 별표, 3번 문제에 X표시 등)",
      "priority": "high|medium|low"
    }
  ],
  "studentNotes": "학생이 적은 손글씨 메모/풀이 내용 (있다면)"
}

마커 우선순위 기준:
- high: 별표(★), 물음표(?), X표시 → 학생이 중요하게 생각하거나 어려워하는 문제
- medium: 체크(✓), 동그라미(○), 밑줄 → 확인이 필요한 문제
- low: 손글씨 메모만 있는 경우

문제나 마커를 찾지 못했으면 해당 배열은 빈 배열로 해주세요.
`.trim();

    const tryGenerate = async (m: any) => {
      const r = await m.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });
      const resp: any = r?.response as any;
      const cand0: any = Array.isArray(resp?.candidates) ? resp.candidates[0] : null;
      const parts: any[] = Array.isArray(cand0?.content?.parts) ? cand0.content.parts : [];
      const textOut = (typeof resp?.text === 'function' ? resp.text() : r.response.text()) || '';
      const hasTextPart = parts.some((p) => typeof p?.text === 'string' && p.text.length > 0);
      return { r, textOut, hasTextPart, cand0 };
    };

    let text = '';
    let modelCall: 'json' | 'text_fallback' = 'json';
    const first = await tryGenerate(modelJson);
    text = first.textOut;
    if (!text.trim()) {
      const second = await tryGenerate(modelText);
      text = second.textOut;
      modelCall = 'text_fallback';
    }

    if (!text.trim()) {
      return NextResponse.json(
        {
          error: '이미지 분석 결과가 비어 있습니다. 다시 시도해주세요.',
          debug:
            process.env.NODE_ENV !== 'production'
              ? { modelCall, imageUrl: imageUpload.imageUrl, mimeType, msg: 'empty text from model' }
              : undefined,
        },
        { status: 500 }
      );
    }

    // JSON 파싱
    let analysis: {
      extractedText?: string;
      subject?: string;
      pageNumber?: number | null;
      recognizedProblems?: Array<{
        number: number;
        text?: string;
        position?: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
      // AI 에이전트: 우선순위 마커 (별표, 체크, X표시 등)
      priorityMarkers?: Array<{
        type: 'star' | 'check' | 'underline' | 'circle' | 'highlight' | 'question_mark' | 'x_mark' | 'handwriting';
        problemNumber?: number | null;
        description?: string;
        priority: 'high' | 'medium' | 'low';
      }>;
      studentNotes?: string; // 학생 손글씨 메모
    } = {
      extractedText: text,
      subject: undefined,
      pageNumber: null,
      recognizedProblems: [],
      priorityMarkers: [],
      studentNotes: undefined,
    };

    let parsedOk = false;
    try {
      // 1) 순수 JSON
      analysis = JSON.parse(text);
      parsedOk = true;
    } catch (parseError) {
      // 2) 코드펜스/앞뒤 텍스트 혼입 시 JSON만 추출
      try {
        const cleaned = text
          .trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```$/i, '')
          .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);
          parsedOk = true;
        }
      } catch (parseError2) {
        console.error('JSON 파싱 오류:', parseError, parseError2);
        // 파싱 실패 시 텍스트만 저장
      }
    }

    // subject 보정: 모델이 subject를 비워줬거나 파싱 실패하면 텍스트 기반으로 추정
    const extracted = analysis?.extractedText || '';
    const subj =
      typeof analysis?.subject === 'string' && analysis.subject.trim() ? analysis.subject.trim() : '';
    // extractedText가 비었으면(또는 파싱 실패) raw text에서라도 과목 추정
    analysis.subject = subj || guessSubjectFromText(extracted || text || '');
    if (!analysis.extractedText) {
      // 파싱 실패하거나 모델이 비워준 경우 raw에서라도 텍스트를 확보
      analysis.extractedText = extracted || '';
    }

    // 개발 환경에서 분석이 빈 경우 디버그 단서 제공
    const debugInfo =
      process.env.NODE_ENV !== 'production'
        ? {
            modelCall,
            parsedOk,
            textPreview: (text || '').slice(0, 300),
            imageUrl: imageUpload.imageUrl,
            mimeType,
          }
        : undefined;

    // 분석 결과 업데이트
    await imageUploads.updateOne(
      { _id: new ObjectId(imageUploadId) } as any,
      {
        $set: {
          analyzed: true,
          analyzedAt: new Date(),
          analysis: analysis,
        } as any,
      }
    );

    return NextResponse.json({
      success: true,
      analysis: analysis,
      imageUpload: {
        ...imageUpload,
        analyzed: true,
        analyzedAt: new Date(),
        analysis: analysis,
      },
      _debug: debugInfo,
    });
  } catch (error) {
    console.error('이미지 분석 오류:', error);
    return NextResponse.json(
      { error: '이미지를 분석하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
