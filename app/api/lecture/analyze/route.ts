import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { loadCorrectAndParseStt, parseJsonWithFallback } from '@/lib/stt-utils';
import { generateWithLimiter } from '@/lib/gemini-rate-limiter';

const LECTURE_API_BASE_URL = 
  process.env.LECTURE_API_BASE_URL || 
  'https://lecture-analysis-pipeline-api.seoltab.com/report-backend';

const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * STT 데이터 분석 및 요약 생성
 * POST /api/lecture/analyze
 * Body: { roomId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId가 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. STT 텍스트 가져오기 및 보정 (공통 유틸리티 사용)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    let conversations;
    try {
      conversations = await loadCorrectAndParseStt(roomId, LECTURE_API_BASE_URL, apiKey);
      
      if (conversations.length === 0) {
        return NextResponse.json(
          { error: 'STT 데이터가 없습니다.' },
          { status: 404 }
        );
      }
      
      console.log('[lecture/analyze] STT 대화 로드 및 보정 완료:', conversations.length, '개');
      if (conversations.length > 0) {
        console.log('[lecture/analyze] 첫 번째 대화 샘플:', {
          speaker: conversations[0].speaker,
          text: conversations[0].text.substring(0, 50) + '...',
        });
      }
    } catch (sttErr) {
      console.error('[lecture/analyze] STT 로드 실패:', sttErr);
      return NextResponse.json(
        { error: 'STT 데이터를 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    // 2. AI로 요약 및 질문 추출 (보정은 이미 loadCorrectAndParseStt에서 완료됨)
    // ※ 대화 데이터를 다시 보정하지 않고, 요약과 질문 추출만 수행

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: 8192, // 요약과 질문만 생성하므로 토큰 제한 축소
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    // 대화 텍스트 생성 (모든 대화 사용)
    const conversationText = conversations
      .map((conv, idx) => `[${idx + 1}] ${conv.speaker === 'teacher' ? '선생님' : '학생'}: ${conv.text}`)
      .join('\n');
    
    console.log('[lecture/analyze] 프롬프트에 사용할 대화 수:', conversations.length);
    console.log('[lecture/analyze] 대화 텍스트 길이:', conversationText.length);

    // 요약과 질문 추출만 수행하는 간단한 프롬프트
    const prompt = `다음 수업 대화 내용을 분석해주세요.

**중요: 반드시 한국어로 응답해주세요. 영어 수업이라도 요약은 한국어로 작성합니다.**

**수업 대화:**
${conversationText}

**요청사항:**
1. **수업 요약**: 수업에서 어떤 개념을 배웠고, 어떤 문제를 풀었는지 상세하게 요약해주세요. (한국어로)
2. **학생 질문**: 학생이 **실제로 궁금해서 한 질문**만 추출해주세요. (한국어로)
   - ✅ 포함: 의문형 질문, 이해가 안 되는 부분에 대한 질문, 이유/원리/방법 질문
   - ❌ 제외: 문제 풀이 답변 (예: "My bag is bigger than yours"), 단순 대답 ("네", "아니요"), 예시 문장 읽기, 맞장구
   - 질문은 **학습적으로 의미 있는 것만** 포함하고, 짧은 맞장구는 제외

**출력 형식 (순수 JSON만, 한국어로 작성):**
{
  "summary": "수업 요약 내용 (상세하게, 한국어로)",
  "studentQuestions": [
    {
      "index": 대화번호,
      "question": "학생 질문 내용 (한국어로)",
      "teacherResponse": "선생님 답변 (한국어로)",
      "contextMeaning": "질문이 나온 문맥/의미 요약",
      "whatNotUnderstood": "학생이 몰랐던 핵심 포인트",
      "whatToKnow": "이번에 꼭 알아야 할 핵심 개념",
      "learningValue": "이 질문이 학습적으로 중요한 이유 (1줄)"
    }
  ]
}

JSON만 응답하세요. 다른 텍스트나 설명은 불필요합니다. **반드시 한국어로 작성하세요.**`;

    const result = await generateWithLimiter(model, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.text();
    
    // 디버깅: 응답 크기 확인
    console.log('[lecture/analyze] Gemini 응답 길이:', responseText.length);
    console.log('[lecture/analyze] Gemini 응답 처음 500자:', responseText.substring(0, 500));
    console.log('[lecture/analyze] Gemini 응답 마지막 500자:', responseText.substring(Math.max(0, responseText.length - 500)));
    
    // JSON 파싱 (요약과 질문만 추출)
    let analysis: any = null;
    
    try {
      analysis = parseJsonWithFallback(responseText);
      console.log('[lecture/analyze] ✅ JSON 파싱 성공');
      console.log('[lecture/analyze] 파싱된 데이터:', {
        hasSummary: !!analysis.summary,
        summaryLength: analysis.summary?.length || 0,
        hasStudentQuestions: !!analysis.studentQuestions,
        questionsCount: analysis.studentQuestions?.length || 0,
      });
    } catch (err: any) {
      console.error('[lecture/analyze] ❌ JSON 파싱 실패:', err?.message);
      console.error('[lecture/analyze] 응답 미리보기:', responseText.substring(0, 500));
    }
    
    // 요약과 질문 추출 결과 반환 (대화는 이미 보정된 것 사용)
    const summary = analysis?.summary || '';
    const studentQuestions = analysis?.studentQuestions || [];
    
    // 요약이 비어있으면 간단한 기본 요약 생성
    const finalSummary = summary || `이 수업에서는 총 ${conversations.length}개의 대화가 진행되었습니다.`;
    
    return NextResponse.json({
      success: true,
      originalConversations: conversations, // 이미 보정된 대화
      correctedConversations: conversations, // 동일한 데이터 (이미 보정됨)
      summary: finalSummary,
      studentQuestions: studentQuestions,
    });

  } catch (error: any) {
    console.error('[lecture/analyze] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'STT 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

