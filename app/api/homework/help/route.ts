import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { generateWithLimiter } from '@/lib/gemini-rate-limiter';

type TutorType = 'rangsam' | 'joonssam';

/**
 * 숙제 도와주기 API
 * POST /api/homework/help
 * Body: {
 *   studentId: string,
 *   studentName?: string,
 *   tutor: 'rangsam' | 'joonssam',
 *   message?: string,
 *   analysis?: any, // 이미지 분석 결과
 *   imageUrl?: string,
 *   chatHistory: ChatMsg[],
 *   currentImageId?: string,
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      studentId,
      studentName,
      tutor,
      message,
      analysis,
      imageUrl,
      chatHistory,
      currentImageId,
    } = body;

    if (!studentId) {
      return NextResponse.json(
        { error: 'studentId가 필요합니다.' },
        { status: 400 }
      );
    }

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
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    });

    const tutorName = tutor === 'joonssam' ? '준쌤' : '랑쌤';
    const tutorPersonality = tutor === 'joonssam' 
      ? '차분하고 친절한 남자 선생님. 수학과 논리적 사고에 강합니다.'
      : '밝고 활발한 여자 선생님. 친근하고 격려하는 말투를 사용합니다.';

    // 프롬프트 생성
    let prompt = `당신은 ${tutorName}입니다. ${tutorPersonality}

${studentName ? `학생 이름: ${studentName}` : ''}

**상황:**
학생이 비법 노트를 다 본 후 숙제를 도와달라고 요청했습니다.
"비법 노트 다 봤어? 숙제도 도와줄 수 있는데, 지금 같이 해볼래?" 라는 느낌으로 친근하게 대화하세요.

**대화 스타일:**
- 학생과 티키타카하며 함께 문제를 풀어가는 느낌
- 직접 답을 알려주지 말고, 힌트를 주거나 단계별로 안내
- 학생이 이해했는지 확인하며 진행
- 격려하고 응원하는 말투

**말투 규칙:**
- 친근하고 따뜻한 반말 사용 ("~야", "~지", "~해", "~거야")
- 격려하고 응원하는 톤
- 학생이 이해할 수 있도록 쉽게 설명
- 단계별로 차근차근 안내
- 너무 직접적인 답을 주지 말고, 힌트를 주거나 함께 생각하도록 유도

`;

    // 이미지 분석 결과가 있으면
    if (analysis) {
      prompt += `\n**이미지 분석 결과:**
- 과목: ${analysis.subject || '미분류'}
- 추출된 텍스트: ${analysis.extractedText?.substring(0, 500) || '없음'}
- 인식된 문제: ${analysis.recognizedProblems?.length || 0}개
${analysis.recognizedProblems?.length > 0 ? `
  ${analysis.recognizedProblems.slice(0, 3).map((p: any, idx: number) => 
    `${idx + 1}. ${p.number}번: ${p.text?.substring(0, 100) || '내용 없음'}`
  ).join('\n  ')}
` : ''}
${analysis.priorityMarkers?.length > 0 ? `
- 학생이 표시한 마커:
  ${analysis.priorityMarkers.map((m: any) => 
    `- ${m.type}: ${m.description || ''} (우선순위: ${m.priority})`
  ).join('\n  ')}
` : ''}

이미지를 보고 학생이 어떤 문제를 풀려고 하는지 파악하고, 친근하게 도와주세요.
`;

      // 이미지도 포함
      if (imageUrl) {
        try {
          const imageRes = await fetch(imageUrl);
          if (imageRes.ok) {
            const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
            const base64Image = imageBuffer.toString('base64');
            const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';
            
            const parts: any[] = [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType,
                },
              },
            ];

            const result = await generateWithLimiter(model, {
              contents: [{ role: 'user', parts }],
            });

            return NextResponse.json({
              success: true,
              message: result.response.text(),
            });
          }
        } catch (imgErr) {
          console.error('이미지 처리 실패:', imgErr);
        }
      }
    }

    // 채팅 히스토리 추가
    if (chatHistory && chatHistory.length > 0) {
      prompt += `\n**대화 히스토리:**\n`;
      chatHistory.slice(-5).forEach((msg: any) => {
        const speaker = msg.from === 'tutor' ? tutorName : '학생';
        prompt += `${speaker}: ${msg.text}\n`;
      });
    }

    // 현재 메시지
    if (message) {
      prompt += `\n**학생의 메시지:** ${message}\n\n`;
    }

    prompt += `\n위 상황을 바탕으로 ${tutorName}의 말투로 친근하게 응답해주세요. 학생이 이해하기 쉽도록 단계별로 설명하거나 힌트를 주세요.`;

    const result = await generateWithLimiter(model, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    return NextResponse.json({
      success: true,
      message: result.response.text(),
    });
  } catch (error) {
    console.error('[homework/help] Error:', error);
    return NextResponse.json(
      { error: '숙제 도와주기 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

