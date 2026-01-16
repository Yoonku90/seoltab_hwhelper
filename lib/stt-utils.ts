/**
 * STT 데이터 처리 공통 유틸리티
 * - STT 파싱 (lecture-monitoring-admin 방식)
 * - STT 보정 (Gemini AI 사용)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export interface Conversation {
  speaker: string;
  text: string;
  timestamp: any;
  imageRef?: string;
}

/**
 * STT JSON 데이터 파싱 (lecture-monitoring-admin 방식)
 */
export function parseSttData(jsonData: any): Conversation[] {
  const rawConversations = Array.isArray(jsonData) 
    ? jsonData 
    : typeof jsonData === 'object' 
    ? Object.values(jsonData).sort((a: any, b: any) => {
        const aIdx = parseInt(a.order_idx || a.index || '0');
        const bIdx = parseInt(b.order_idx || b.index || '0');
        return aIdx - bIdx;
      })
    : [];
  
  const conversations = rawConversations
    .map((conv: any) => {
      // lecture-monitoring-admin 방식: user === 'teacher'로 판단하고 teacher_text/student_text 사용
      let speaker = 'unknown';
      let text = '';
      
      if (conv.user === 'teacher' || conv.user === 'T' || conv.speaker === 'teacher') {
        speaker = 'teacher';
        text = conv.teacher_text || conv.text || conv.content || conv.transcript || '';
      } else if (conv.user === 'student' || conv.user === 'S' || conv.speaker === 'student') {
        speaker = 'student';
        text = conv.student_text || conv.text || conv.content || conv.transcript || '';
      } else {
        // 기존 방식 fallback
        speaker = conv.speaker || conv.role || 'unknown';
        text = conv.text || conv.content || conv.transcript || '';
      }
      
      const timestamp = conv.timestamp || conv.time || conv.start || null;
      const imageRef = conv.image_url || conv.imageUrl || conv.image || null;
      
      return { speaker, text, timestamp, imageRef };
    })
    .filter((conv: Conversation) => conv.text && conv.text.trim().length > 0); // 빈 텍스트 제거
  
  return conversations;
}

/**
 * STT 텍스트 전처리 (NaN 값 제거)
 */
export function preprocessSttText(text: string): string {
  return text
    .replace(/:\s*NaN\s*([,}])/g, ': null$1')
    .replace(/:\s*"NaN"\s*([,}])/g, ': null$1')
    .replace(/:\s*Infinity\s*([,}])/g, ': null$1')
    .replace(/:\s*-Infinity\s*([,}])/g, ': null$1');
}

/**
 * JSON 파싱 (여러 단계 시도) - 강력한 파싱 로직
 */
export function parseJsonWithFallback(jsonText: string): any {
  let cleaned = jsonText.trim();
  
  // 코드 블록 제거
  if (cleaned.startsWith('```')) {
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1];
    } else {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
  }
  
  // 시도 1: 직접 파싱
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // 시도 2: 정리 후 파싱
    try {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      
      // 주석 제거 (한 줄 주석과 여러 줄 주석)
      cleaned = cleaned.replace(/\/\/.*$/gm, '');
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // trailing comma 제거 (여러 번 실행하여 중첩된 경우 처리)
      for (let i = 0; i < 10; i++) {
        cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      }
      
      // 이스케이프되지 않은 줄바꿈을 문자열 내부에서 공백으로 변경 (신중하게)
      // 문자열 내부의 줄바꿈만 처리 (이스케이프 고려)
      cleaned = cleaned.replace(/([^\\])"([^"]*)\n([^"]*)"/g, '$1"$2 $3"');
      
      return JSON.parse(cleaned);
    } catch (err2) {
      // 시도 3: JSON 부분만 추출 (더 정교하게)
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          let extracted = jsonMatch[0];
          // 다시 정리
          extracted = extracted
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '');
          for (let i = 0; i < 5; i++) {
            extracted = extracted.replace(/,(\s*[}\]])/g, '$1');
          }
          return JSON.parse(extracted);
        } catch (err3) {
          // 시도 4: 가장 바깥쪽 중괄호 쌍만 추출
          let braceCount = 0;
          let start = -1;
          let end = -1;
          // 문자열 내부를 고려한 중괄호 매칭
          let inString = false;
          let escapeNext = false;
          
          for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (inString) continue;
            
            if (char === '{') {
              if (braceCount === 0) start = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && start !== -1) {
                end = i;
                break;
              }
            }
          }
          
          if (start !== -1 && end !== -1) {
            try {
              const finalExtracted = cleaned.substring(start, end + 1);
              // 최종 정리
              let final = finalExtracted
                .replace(/\/\/.*$/gm, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');
              for (let i = 0; i < 10; i++) {
                final = final.replace(/,(\s*[}\]])/g, '$1');
              }
              return JSON.parse(final);
            } catch (err4) {
              // 시도 5: JSON5 스타일 파싱 시도 (더 관대한 파싱)
              try {
                // undefined를 null로 변환
                let relaxed = cleaned
                  .replace(/undefined/g, 'null')
                  .replace(/\/\/.*$/gm, '')
                  .replace(/\/\*[\s\S]*?\*\//g, '');
                for (let i = 0; i < 10; i++) {
                  relaxed = relaxed.replace(/,(\s*[}\]])/g, '$1');
                }
                return JSON.parse(relaxed);
              } catch (err5) {
                throw new Error('JSON 파싱 실패');
              }
            }
          }
          throw new Error('JSON 파싱 실패');
        }
      }
      throw new Error('JSON 파싱 실패');
    }
  }
}

/**
 * STT 보정 (Gemini AI 사용)
 */
export async function correctStt(
  conversations: Conversation[],
  apiKey: string
): Promise<Conversation[]> {
  try {
    console.log('[stt-utils] 🔧 STT 보정 시작...', conversations.length, '개 대화');
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const correctionModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-pro',
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: 32768, // 더 많은 대화를 처리하기 위해 토큰 제한 증가
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    });

    // 보정용 프롬프트
    const correctionPrompt = `당신은 수업 STT 데이터 보정 전문가입니다. 다음 STT 데이터를 **문맥에 맞게** 보정해주세요.

**STT 대화 데이터 (모든 대화 포함):**
${conversations
  .map((conv, idx) => `[${idx + 1}] ${conv.speaker}: ${conv.text}`)
  .join('\n')}

**작업:**
1. **STT 보정**: 잘못 인식된 단어, 문장을 문맥에 맞게 보정
   - 예: "관계대명사"가 "관계 대명사"로 잘못 띄어쓰기 된 경우 → "관계대명사"로 수정
   - 예: 오타 수정, 문맥에 맞지 않는 단어 교정
   - 예: "이거" → "이것", "그거" → "그것" 등 자연스러운 표현으로 수정
   - 수업 맥락을 보고 **동음이의어/유사 발음**을 올바른 용어로 보정
   - 수학/영어/과학 등 **교과 용어는 표준 표기**로 수정

2. **화자(speaker) 판단 및 보정**: 문맥을 분석하여 화자가 올바르게 설정되었는지 확인
   - JSON의 speaker 정보가 "teacher" 또는 "student"로 되어 있지만, 문맥상 다르게 판단되는 경우 수정
   - 예: JSON에서 "student"로 되어 있지만, 문맥상 선생님이 설명하는 내용이면 → "teacher"로 수정
   - 예: JSON에서 "teacher"로 되어 있지만, 문맥상 학생이 질문하는 내용이면 → "student"로 수정
   - 문맥 판단 기준:
     * 선생님: 설명, 질문하기, 개념 설명, 문제 제시, 정답 알려주기, 격려하기
     * 학생: 질문하기, 답변하기, "모르겠어요", "네", "아니요" 같은 반응

3. **원본 내용 최대한 유지**: 보정은 최소한으로, 명확한 오인식만 수정
4. **문맥 보정**: 앞뒤 대화 흐름을 보고 어색한 단어/어미만 자연스럽게 보정
5. **모든 대화 포함**: 입력된 모든 대화를 반드시 출력에 포함 (일부만 선택하지 말 것)

**출력 형식 (JSON):**
{
  "correctedConversations": [
    {
      "index": 1,
      "speaker": "teacher" 또는 "student" (문맥 분석 후 판단),
      "text": "보정된 텍스트",
      "timestamp": "원본 timestamp 또는 null"
    }
  ]
}

**중요 규칙:**
- 반드시 유효한 JSON 형식으로만 응답
- 모든 문자열 값은 이중 따옴표로 감싸야 함
- 문자열 내부의 따옴표는 이스케이프(\\") 처리
- trailing comma 사용 금지
- STT 보정은 최소한으로, 오타나 명확한 오인식만 수정
- 원본 내용을 최대한 유지
- **모든 대화를 반드시 포함** (입력된 대화 수와 출력된 대화 수가 동일해야 함)
- 화자 판단은 문맥을 기준으로 정확하게 해야 함
- **새로운 내용 추가 금지** (추측/각색/요약 금지)
- 한국어로 출력`;

    const correctionResult = await correctionModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: correctionPrompt }] }],
    });

    let correctionResponseText = correctionResult.response.text();
    let correctionData: any | null = null;

    try {
      correctionData = parseJsonWithFallback(correctionResponseText);
    } catch (parseErr) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[stt-utils] STT 보정 JSON 파싱 실패, 재시도합니다.');
      }

      const retryPrompt = `반드시 아래 형식의 **순수 JSON**만 출력하세요. 코드 블록, 설명, 주석, 부가 텍스트 금지.

**출력 형식 (JSON만):**
{
  "correctedConversations": [
    {
      "index": 1,
      "speaker": "teacher" 또는 "student",
      "text": "보정된 텍스트",
      "timestamp": "원본 timestamp 또는 null"
    }
  ]
}

**규칙 (매우 중요):**
- 모든 대화를 반드시 포함 (입력된 대화 수와 동일)
- 문자열은 반드시 이중 따옴표 사용
- 줄바꿈은 \\n으로 표현
- trailing comma 금지
- 새로운 내용 추가 금지
- 한국어로 출력

**STT 대화 데이터:**
${conversations.map((conv, idx) => `[${idx + 1}] ${conv.speaker}: ${conv.text}`).join('\n')}
`;

      const retryModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-pro',
        safetySettings: GEMINI_SAFETY_SETTINGS,
        generationConfig: {
          maxOutputTokens: 32768,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const retryResult = await retryModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: retryPrompt }] }],
      });

      const retryText = retryResult.response.text();
      try {
        correctionData = parseJsonWithFallback(retryText);
        correctionResponseText = retryText;
      } catch (retryErr) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[stt-utils] STT 보정 재시도도 실패, 원본 사용');
        }
        correctionData = null;
      }
    }

    if (correctionData && correctionData.correctedConversations && Array.isArray(correctionData.correctedConversations)) {
      if (correctionData.correctedConversations.length !== conversations.length) {
        console.warn('[stt-utils] STT 보정 대화 수 불일치, 원본 사용');
        return conversations;
      }
      const corrected = correctionData.correctedConversations.map((corr: any) => {
        const original = conversations[corr.index - 1] || conversations.find((c) => c.speaker === corr.speaker);
        return {
          speaker: corr.speaker || original?.speaker || 'unknown',
          text: corr.text || original?.text || '',
          timestamp: corr.timestamp || original?.timestamp || null,
          imageRef: original?.imageRef || null,
        };
      });
      
      console.log('[stt-utils] ✅ STT 보정 완료');
      return corrected;
    } else {
      console.warn('[stt-utils] STT 보정 데이터 형식 오류, 원본 사용');
      return conversations;
    }
  } catch (correctionErr) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[stt-utils] STT 보정 실패, 원본 사용:', correctionErr);
    }
    return conversations; // 보정 실패 시 원본 반환
  }
}

/**
 * STT 데이터 로드 및 파싱 (전체 프로세스)
 */
export async function loadAndParseStt(
  roomId: string,
  lectureApiBaseUrl: string
): Promise<Conversation[]> {
  try {
    const sttRes = await fetch(`${lectureApiBaseUrl}/text/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_ids: [roomId] }),
    });

    if (!sttRes.ok) {
      throw new Error(`STT API 오류: ${sttRes.status}`);
    }

    const sttData = await sttRes.json();
    if (!sttData.data || sttData.data.length === 0) {
      return [];
    }

    const item = sttData.data[0];
    if (!item.presigned_url) {
      return [];
    }

    const s3Res = await fetch(item.presigned_url);
    if (!s3Res.ok) {
      throw new Error(`S3 오류: ${s3Res.status}`);
    }

    let text = await s3Res.text();
    text = preprocessSttText(text);
    
    const jsonData = JSON.parse(text);
    const conversations = parseSttData(jsonData);
    
    console.log('[stt-utils] STT 로드 완료:', conversations.length, '개 대화');
    return conversations;
  } catch (error) {
    console.error('[stt-utils] STT 로드 실패:', error);
    throw error;
  }
}

/**
 * STT 데이터 로드, 파싱, 보정 (전체 프로세스)
 */
export async function loadCorrectAndParseStt(
  roomId: string,
  lectureApiBaseUrl: string,
  apiKey: string
): Promise<Conversation[]> {
  const conversations = await loadAndParseStt(roomId, lectureApiBaseUrl);
  
  if (conversations.length === 0) {
    return [];
  }

  // 원본 STT를 그대로 사용
  return conversations;
}

