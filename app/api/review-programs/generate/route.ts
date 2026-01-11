import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { REVIEW_PROGRAM_PROMPT } from '@/lib/prompts';
import type { ReviewProgram } from '@/lib/types';

// POST /api/review-programs/generate
// 오늘 과외 페이지(이미지 분석 결과) + 시간(durationMinutes)을 기반으로 복습 프로그램 생성/저장
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      studentId,
      teacherId,
      durationMinutes,
      analysis,
      imageUrl,
      grade,
      intent,
      tutor = 'rangsam', // 기본값: rangsam
    } = body as {
      studentId?: string;
      teacherId?: string;
      durationMinutes?: 10 | 30 | 60 | 120;
      analysis?: any;
      imageUrl?: string;
      grade?: string;
      intent?: 'review' | 'homework';
      tutor?: 'rangsam' | 'joonssam';
    };

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }
    if (!durationMinutes || ![10, 30, 60, 120].includes(durationMinutes)) {
      return NextResponse.json(
        { error: 'durationMinutes는 10/30/60/120 중 하나여야 합니다.' },
        { status: 400 }
      );
    }
    if (!analysis || typeof analysis !== 'object') {
      return NextResponse.json({ error: 'analysis가 필요합니다.' }, { status: 400 });
    }

    const extractedText: string =
      analysis.extractedText ||
      (typeof analysis === 'string' ? analysis : '') ||
      '';
    const subject: string = analysis.subject || '미분류';
    const recognizedProblems: Array<{ number: number; text?: string }> = Array.isArray(
      analysis.recognizedProblems
    )
      ? analysis.recognizedProblems
          .filter((p: any) => typeof p?.number === 'number')
          .map((p: any) => ({ number: p.number, text: p.text }))
      : [];

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const prompt = REVIEW_PROGRAM_PROMPT.replace('{extractedText}', extractedText)
      .replace(
        '{recognizedProblems}',
        recognizedProblems.length
          ? recognizedProblems.map((p) => `- ${p.number}. ${p.text || ''}`).join('\n')
          : '(없음)'
      )
      .replace('{subject}', subject)
      .replace('{grade}', grade || '미설정')
      .replace('{durationMinutes}', String(durationMinutes));

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // 복습 프로그램 생성(문제 생성, 개념 생성)은 2.5 pro 사용 (품질 중요)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.5,
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    const text = result.response.text();

    // JSON 파싱
    let parsed: any = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      parsed = null;
    }

    const now = new Date();
    
    // 제목: 모델이 생성한 제목 우선, 없으면 친근한 기본값
    let title = parsed?.title || `${subject} 복습하기`;
    
    // 제목에 "선생님과 함께" 추가 (없으면 추가)
    const tutorName = tutor === 'joonssam' ? '준쌤' : '랑쌤';
    if (!title.includes('준쌤') && !title.includes('랑쌤')) {
      // 제목 끝에 "! 선생님과 함께" 추가
      title = title.replace(/\s*!?\s*$/, '') + `! ${tutorName}과 함께`;
    }

    let keyPoints: string[] = Array.isArray(parsed?.keyPoints)
      ? parsed.keyPoints.filter((x: any) => typeof x === 'string')
      : [];
    
    // keyPoints가 비어있거나 너무 적으면 extractedText에서 기본 keyPoints 생성
    if (keyPoints.length < 3 && extractedText) {
      console.log('[generate] keyPoints가 부족해서 기본 생성 시도:', keyPoints.length);
      
      // JSON 형태가 아닌 실제 텍스트만 사용
      let cleanText = extractedText;
      // JSON 형태 제거 ({"extractedText": "..."} 같은 패턴)
      if (cleanText.includes('"extractedText"') || cleanText.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleanText);
          cleanText = parsed.extractedText || parsed.text || '';
        } catch {
          // JSON 파싱 실패하면 그대로 사용하되 JSON 키워드 제거
          cleanText = cleanText.replace(/"extractedText"\s*:\s*"/g, '').replace(/[{}"]/g, '');
        }
      }
      
      // 텍스트에서 핵심 문장들 추출 (마침표/느낌표로 분리)
      const sentences = cleanText
        .split(/[.!?。\n]/g)
        .map(s => s.trim())
        .filter(s => s.length > 10 && s.length < 200 && !s.includes('extractedText') && !s.includes('"'));
      
      // 중요해 보이는 문장들을 keyPoints에 추가
      const additionalPoints = sentences.slice(0, Math.max(5, 7 - keyPoints.length));
      keyPoints = [...keyPoints, ...additionalPoints];
      console.log('[generate] 보완된 keyPoints 개수:', keyPoints.length);
    }
    
    // keyPoints에서 JSON 형태 문자열 제거
    keyPoints = keyPoints.filter(kp => 
      !kp.includes('"extractedText"') && 
      !kp.startsWith('{') && 
      !kp.includes('":"') &&
      kp.length > 5
    );

    const mode: 'problem_set' | 'concept' =
      parsed?.mode === 'problem_set' || parsed?.mode === 'concept'
        ? parsed.mode
        : recognizedProblems.length >= 3
          ? 'problem_set'
          : 'concept';

    const resolvedIntent: 'review' | 'homework' =
      intent === 'homework' || intent === 'review'
        ? intent
        : mode === 'problem_set'
          ? 'review'
          : 'review';

    const practiceProblems: Array<{ problemText?: string; relatedToOriginal?: string; imageUrl?: string }> =
      Array.isArray(parsed?.practiceProblems)
        ? parsed.practiceProblems.map((p: any) => ({
            problemText: typeof p?.problemText === 'string' ? p.problemText : undefined,
            relatedToOriginal:
              typeof p?.relatedToOriginal === 'string' ? p.relatedToOriginal : undefined,
            imageUrl: imageUrl || undefined,
          }))
        : [];

    const quiz: Array<{ question: string; answer: string }> = Array.isArray(parsed?.quiz)
      ? parsed.quiz
          .filter((q: any) => typeof q?.question === 'string' && typeof q?.answer === 'string')
          .map((q: any) => ({ question: q.question, answer: q.answer }))
      : [];

    const reviewProgram: ReviewProgram = {
      studentId,
      teacherId: teacherId || 'teacher1',
      tutor: tutor || 'rangsam', // 선생님 선택 (기본: rangsam)
      originalSessionId: 'today', // MVP: 오늘 과외 기준(세션 연결은 추후)
      title,
      durationMinutes,
      mode,
      intent: resolvedIntent,
      source: {
        subject,
        imageUrl: imageUrl || undefined,
        extractedText,
        recognizedProblems,
        grade: grade || undefined,
      },
      createdAt: now,
      startAt: now,
      reviewContent: {
        keyPoints: keyPoints.length ? keyPoints : ['핵심 포인트를 정리해보세요.'],
        // problem_set일 때는 원본 문제를 우선 포함 (없으면 생성된 연습 사용)
        practiceProblems:
          mode === 'problem_set' && recognizedProblems.length
            ? recognizedProblems.map((p) => ({
                problemText: p.text || `문제 ${p.number}`,
                relatedToOriginal: `원본 문제 ${p.number}`,
                imageUrl: imageUrl || undefined,
              }))
            : practiceProblems.length
              ? practiceProblems
              : [{ problemText: '오늘 배운 내용에서 핵심 문장을 3개만 적어보세요.' }],
        quiz: quiz.length ? quiz : [{ question: '오늘 배운 내용에서 가장 중요한 1가지는?', answer: '핵심 개념 1가지' }],
      },
      progress: {
        completed: false,
        completedItems: 0,
        totalItems:
          (keyPoints.length ? keyPoints.length : 1) +
          ((mode === 'problem_set' && recognizedProblems.length)
            ? recognizedProblems.length
            : (practiceProblems.length ? practiceProblems.length : 1)) +
          (quiz.length ? quiz.length : 1),
        lastActivityAt: now,
      },
    };

    const col = await Collections.reviewPrograms();
    const insert = await col.insertOne(reviewProgram as any);

    return NextResponse.json({
      success: true,
      reviewProgram: { ...reviewProgram, _id: insert.insertedId.toString() },
    });
  } catch (error) {
    console.error('복습 프로그램 생성 오류:', error);
    return NextResponse.json(
      { error: '복습 프로그램을 생성하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}


