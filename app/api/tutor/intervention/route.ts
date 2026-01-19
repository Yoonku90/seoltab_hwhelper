import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// POST /api/tutor/intervention - AI 튜터 개입 (1차/2차/탈출구)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { problemId, studentId, interventionType, stuckPoint } = body;

    if (!problemId || !studentId || !interventionType) {
      return NextResponse.json(
        { error: 'problemId, studentId, interventionType이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(problemId)) {
      return NextResponse.json(
        { error: '유효하지 않은 문제 ID입니다.' },
        { status: 400 }
      );
    }

    const problems = await Collections.problems();
    const aiTutorSessions = await Collections.aiTutorSessions();
    const problem = await problems.findOne({ _id: new ObjectId(problemId) } as any);

    if (!problem) {
      return NextResponse.json(
        { error: '문제를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AI 튜터 세션 확인
    let session = await aiTutorSessions.findOne({
      problemId,
      studentId,
    });

    const interventionCount = session?.interventionCount || 0;

    // 이미 개입이 완료된 경우
    if (interventionCount >= 2 && interventionType !== 'escape_route') {
      return NextResponse.json(
        { error: '이미 최대 개입 횟수에 도달했습니다.' },
        { status: 400 }
      );
    }

    // AI 개입 메시지 생성
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

    // 이미지 읽기
    let parts: any[] = [];
    if (problem.imageUrl) {
      try {
        const urlObj = new URL(problem.imageUrl, req.nextUrl.origin);
        const fileId = urlObj.searchParams.get('fileId') || urlObj.pathname.split('/').pop()?.split('.')[0];
        
        if (fileId) {
          const UPLOAD_DIR = join(process.cwd(), 'uploads', 'images');
          const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
          let imageBuffer: Buffer | null = null;
          let mimeType = 'image/jpeg';

          for (const ext of extensions) {
            const filePath = join(UPLOAD_DIR, `${fileId}${ext}`);
            if (existsSync(filePath)) {
              imageBuffer = await readFile(filePath);
              if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
              else if (ext === '.png') mimeType = 'image/png';
              else if (ext === '.webp') mimeType = 'image/webp';
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
      }
    }

    // 프롬프트 생성
    let prompt = '';
    if (interventionType === 'check_in') {
      prompt = `
당신은 친절한 AI 튜터입니다. 학생이 문제를 풀다가 멈춘 것 같습니다.

[문제]
${problem.problemText || '문제 이미지를 확인해주세요.'}

[막힌 지점]
${stuckPoint || '학생이 막힌 지점이 무엇인지 선택하도록 도와주세요'}

[요구사항 - 1차 개입: 가볍게 상태 묻기]
1. 감시하는 느낌을 주지 말고 친근하게
2. 막힌 지점을 파악하도록 선택지를 제공
3. **절대로 긴 설명 금지, 행동 1개만 제시**

다음 형식으로 응답:
{
  "message": "잠깐 멈춘 것 같아. 어디에서 막혔어?",
  "choices": [
    "조건 정리",
    "식 세우기", 
    "계산",
    "다음 단계가 안 떠오름",
    "그냥 하기 싫어짐"
  ],
  "actionType": "check_in",
  "nextStep": "선택에 따라 간단한 행동 제시"
}

반말 금지! 존댓말만 사용하세요.
`.trim();
    } else if (interventionType === 'half_mission') {
      prompt = `
당신은 친절한 AI 튜터입니다. 학생이 문제를 풀다가 계속 막혀서 절반 성공 미션을 제공해야 합니다.

[문제]
${problem.problemText || '문제 이미지를 확인해주세요.'}

[막힌 지점]
${stuckPoint || '알 수 없음'}

[요구사항 - 2차 개입: 절반 성공 과제 (90% 성공 설계)]
1. 끝까지 풀지 말고, 여기까지만 해보도록 유도
2. 막힌 지점에 맞는 절반 미션 생성
3. 빈칸 1-2개 정도로 성공 확률 80-90% 설계
4. 성공하면 즉시 강화 메시지

막힌 지점이 "조건 정리"면 → 조건만 식 2개로 바꿔 적는 미션
막힌 지점이 "식 세우기"면 → 목표식의 왼쪽에 뭐가 와야 할지 빈칸 채우기
막힌 지점이 "계산"이면 → 계산을 2단계로 나눠 1단계 결과만 구하기

다음 형식으로 응답:
{
  "message": "좋아. 끝까지 말고, 여기까지만 해보자.",
  "mission": {
    "type": "condition|equation|calculation",
    "title": "미션 제목",
    "description": "구체적인 미션 설명",
    "template": "빈칸이 있는 템플릿",
    "hint": "간단한 힌트"
  },
  "actionType": "half_mission",
  "encouragement": "성공하면 보여줄 메시지"
}

반말 금지! 존댓말만 사용하세요.
`.trim();
    } else if (interventionType === 'escape_route') {
      prompt = `
당신은 친절한 AI 튜터입니다. 학생이 계속 막혀서 탈출구를 제공해야 합니다.

[문제]
${problem.problemText || '문제 이미지를 확인해주세요.'}

[요구사항 - 탈출구: 포기 허용 + 다음 액션 고정]
1. 실패감 누적을 차단
2. "여기서 막히는 건 정상"이라는 메시지
3. 다음 수업에서 무엇을 집중할지 제시
4. 여기까지 한 것도 저장할 수 있도록

다음 형식으로 응답:
{
  "message": "여기서 막히는 건 정상이야. 오늘은 여기까지만 저장하고, 다음 수업에서 튜터랑 '식 세우기'만 5분 집중하자.",
  "actionType": "escape_route",
  "options": [
    "여기까지 제출",
    "튜터에게 질문 남기기",
    "비슷한 더 쉬운 1문제"
  ],
  "nextSessionFocus": "식 세우기"
}

반말 금지! 존댓말만 사용하세요.
`.trim();
    }

    parts.push({ text: prompt });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = await result.response;
    const text = response.text();

    // JSON 파싱
    let interventionData: any;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        interventionData = JSON.parse(jsonMatch[0]);
      } else {
        interventionData = { message: text };
      }
    } catch (parseError) {
      interventionData = { message: text };
    }

    // 세션 업데이트 또는 생성
    const now = new Date();
    if (!session) {
      session = {
        problemId,
        assignmentId: problem.assignmentId,
        studentId,
        sessionType: 'understanding_recovery',
        understandingState: interventionType === 'escape_route' ? 'stuck' : 'checking',
        stuckPoint: stuckPoint as any,
        stuckScore: 0,
        interventionCount: 1,
        lastInterventionAt: now,
        messages: [
          {
            role: 'ai',
            content: interventionData.message || text,
            timestamp: now,
            actionType: interventionType as any,
          },
        ],
        createdAt: now,
        updatedAt: now,
      } as any;
      await aiTutorSessions.insertOne(session as any);
    } else {
      await aiTutorSessions.updateOne(
        { _id: session._id },
        {
          $set: {
            understandingState: interventionType === 'escape_route' ? 'stuck' : 'checking',
            stuckPoint: stuckPoint as any,
            interventionCount: (session.interventionCount || 0) + 1,
            lastInterventionAt: now,
            updatedAt: now,
          },
          $push: {
            messages: {
              role: 'ai',
              content: interventionData.message || text,
              timestamp: now,
              actionType: interventionType as any,
            },
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      intervention: interventionData,
      session: {
        ...session,
        interventionCount: (session.interventionCount || 0) + 1,
      },
    });
  } catch (error) {
    console.error('AI 개입 오류:', error);
    return NextResponse.json(
      { error: 'AI 개입을 실행하는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
