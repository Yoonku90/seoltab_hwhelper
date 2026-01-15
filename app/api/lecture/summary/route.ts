import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Collections } from '@/lib/db';
import { loadCorrectAndParseStt, type Conversation } from '@/lib/stt-utils';

// Lecture Analysis Pipeline API Base URL
const LECTURE_API_BASE_URL = 
  process.env.LECTURE_API_BASE_URL || 
  'https://lecture-analysis-pipeline-api.seoltab.com/report-backend';

// SafetySettings 상수 (최적화: 중복 설정 제거)
const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// MIME 타입 감지 함수 (최적화: 중복 로직 제거)
function detectImageMimeType(imageUrl: string, contentType: string | null, imageBuffer: Buffer): string {
  // Content-Type 헤더 우선
  if (contentType && contentType !== 'application/octet-stream' && contentType !== 'binary/octet-stream') {
    return contentType;
  }
  
  // URL 확장자로 확인
  const urlLower = imageUrl.toLowerCase();
  if (urlLower.includes('.png')) return 'image/png';
  if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) return 'image/jpeg';
  if (urlLower.includes('.webp')) return 'image/webp';
  if (urlLower.includes('.gif')) return 'image/gif';
  
  // 이미지 바이트 시그니처로 확인
  if (imageBuffer.length >= 4) {
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
      return 'image/png';
    }
    if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF) {
      return 'image/jpeg';
    }
    if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x36) {
      return 'image/gif';
    }
    if (imageBuffer.length >= 12 && 
        imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && 
        imageBuffer[8] === 0x57 && imageBuffer[9] === 0x45 && imageBuffer[10] === 0x42 && imageBuffer[11] === 0x50) {
      return 'image/webp';
    }
  }
  
  // 기본값
  return 'image/jpeg';
}

// 이미지 다운로드 및 변환 함수 (최적화: 재사용)
async function downloadAndConvertImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      return null;
    }
    
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type');
    const mimeType = detectImageMimeType(imageUrl, contentType, imageBuffer);
    
    // 유효한 이미지 MIME 타입인지 확인
    const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimeTypes.includes(mimeType)) {
      console.warn(`[lecture/summary] ⚠️ 지원하지 않는 이미지 형식: ${mimeType}, 이미지 제외`);
      return null;
    }
    
    return {
      buffer: imageBuffer,
      mimeType: mimeType === 'image/jpg' ? 'image/jpeg' : mimeType,
    };
  } catch (err) {
    console.warn(`[lecture/summary] 이미지 다운로드 실패 (${imageUrl.substring(0, 50)}...):`, err);
    return null;
  }
}

/**
 * Room ID로 수업 써머리 생성
 * POST /api/lecture/summary
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

    // API 키 확인 (STT 보정에 필요)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // genAI 초기화 (STT 보정에 사용)
    const genAI = new GoogleGenerativeAI(apiKey);

    // 🚀 최적화 1: 병렬 처리 - Room metadata, STT, 이미지, 학생 정보를 동시에 로드
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    const [roomMetaRes, sttPromise, imagesPromise, studentInfoPromise] = await Promise.allSettled([
      // 1. Room 메타데이터
      fetch(`${LECTURE_API_BASE_URL}/meta/room/${roomId}`, {
        headers: { 'Content-Type': 'application/json' },
      }),
      // 2. STT 텍스트 가져오기 및 보정 (공통 유틸리티 사용)
      loadCorrectAndParseStt(roomId, LECTURE_API_BASE_URL, apiKey),
      // 3. 교재 이미지 가져오기
      (async () => {
        try {
          const baseUrl = req.nextUrl.origin;
          const imagesRes = await fetch(`${baseUrl}/api/admin/room-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId }),
          });
          if (imagesRes.ok) {
            const imagesData = await imagesRes.json();
            return imagesData.urls && Array.isArray(imagesData.urls) ? imagesData.urls : [];
          }
          return [];
        } catch {
          return [];
        }
      })(),
      // 4. 학생 정보 (Pagecall API)
      (async () => {
        try {
          const pagecallToken = process.env.PAGECALL_API_TOKEN;
          if (!pagecallToken) {
            console.warn('[lecture/summary] ⚠️ PAGECALL_API_TOKEN이 설정되지 않았습니다.');
            return { studentId: null, studentName: null, studentNickname: null };
          }
          
          if (isDevelopment) {
            console.log(`[lecture/summary] 🔍 Pagecall API 호출 시작: rooms/${roomId}/sessions`);
          }
          
          const sessionsRes = await fetch(`https://api.pagecall.com/v1/rooms/${roomId}/sessions`, {
            headers: {
              'Authorization': `Bearer ${pagecallToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!sessionsRes.ok) {
            console.warn(`[lecture/summary] ⚠️ Pagecall API 호출 실패: ${sessionsRes.status} ${sessionsRes.statusText}`);
            return { studentId: null, studentName: null, studentNickname: null };
          }

          const sessionsData = await sessionsRes.json();
          
          if (isDevelopment) {
            console.log(`[lecture/summary] 📊 Pagecall API 응답:`, {
              ok: sessionsData.ok,
              sessionsCount: sessionsData.sessions?.length || 0,
            });
          }
          
          if (sessionsData.sessions && Array.isArray(sessionsData.sessions)) {
            for (const session of sessionsData.sessions) {
              if (session.user_id && typeof session.user_id === 'string') {
                if (isDevelopment) {
                  console.log(`[lecture/summary] 🔍 세션 user_id 확인:`, session.user_id);
                }
                
                // 패턴 매칭: "이름(S_숫자)" 형식
                const fullMatch = session.user_id.match(/^(.+?)\(S_(\d+)\)$/);
                if (fullMatch) {
                  const studentName = fullMatch[1].trim();
                  const studentId = fullMatch[2];
                  const studentNickname = studentName && studentName.length >= 2 
                    ? studentName.slice(-2) 
                    : studentName;
                  
                  console.log(`[lecture/summary] ✅ 학생 정보 발견: ${studentName} (ID: ${studentId}, 닉네임: ${studentNickname})`);
                  return { studentId, studentName, studentNickname };
                } else {
                  // 다른 형식도 시도: "S_숫자"만 있는 경우
                  const simpleMatch = session.user_id.match(/S_(\d+)/);
                  if (simpleMatch) {
                    const studentId = simpleMatch[1];
                    console.log(`[lecture/summary] ✅ 학생 ID 발견 (이름 없음): ${studentId}`);
                    return { studentId, studentName: null, studentNickname: null };
                  }
                }
              }
            }
            
            if (isDevelopment) {
              console.warn(`[lecture/summary] ⚠️ 학생 정보를 찾을 수 없습니다. 세션 수: ${sessionsData.sessions.length}`);
              console.log(`[lecture/summary] 세션 user_id 목록:`, sessionsData.sessions.map((s: any) => s.user_id));
            }
          }
          
          return { studentId: null, studentName: null, studentNickname: null };
        } catch (err: any) {
          console.error('[lecture/summary] ❌ Pagecall API 호출 중 오류:', err?.message || err);
          return { studentId: null, studentName: null, studentNickname: null };
        }
      })(),
    ]);

    // Room 메타데이터 처리
    if (roomMetaRes.status === 'rejected' || !roomMetaRes.value.ok) {
      return NextResponse.json(
        { error: 'Room을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    const roomMeta = await roomMetaRes.value.json();
    const subject = roomMeta.subject || '미분류';
    const tutoringDatetime = roomMeta.tutoring_datetime || null;

    // 학생 정보 처리
    let studentId: string | null = null;
    let studentName: string | null = null;
    let studentNickname: string | null = null;
    
    if (studentInfoPromise.status === 'fulfilled') {
      const studentInfo = studentInfoPromise.value;
      studentId = studentInfo.studentId;
      studentName = studentInfo.studentName;
      studentNickname = studentInfo.studentNickname;
      
      if (isDevelopment) {
        console.log(`[lecture/summary] 📋 학생 정보 최종 결과:`, {
          studentId: studentId || 'null',
          studentName: studentName || 'null',
          studentNickname: studentNickname || 'null',
        });
      }
    } else {
      console.error('[lecture/summary] ❌ 학생 정보 로드 실패:', studentInfoPromise.reason);
    }

    // STT 처리 (병렬로 이미 로드됨)
    let sttText = null;
    let missedParts: Array<{question: string, studentResponse: string, correctAnswer?: string, explanation?: string}> = [];
    let fullConversation: Conversation[] = [];
    
    if (sttPromise.status === 'fulfilled') {
      fullConversation = sttPromise.value;
      
      if (fullConversation.length > 0) {
        // 보정된 STT 텍스트 생성
        sttText = fullConversation
          .map((conv) => `[${conv.speaker}]: ${conv.text}`)
          .join('\n');

        // 학생이 놓친 부분 분석
        missedParts = [];
        for (let i = 0; i < fullConversation.length - 1; i++) {
          const current = fullConversation[i];
          const next = fullConversation[i + 1];
          
          if (
            (current.speaker === 'teacher' || current.speaker === '선생님' || current.speaker?.includes('teacher') || current.speaker?.includes('선생')) &&
            (next.speaker === 'student' || next.speaker === '학생' || next.speaker?.includes('student') || next.speaker?.includes('학생'))
          ) {
            const teacherText = current.text.toLowerCase();
            const studentText = next.text.toLowerCase();
            
            const isQuestion = teacherText.includes('?') || 
                              teacherText.includes('어떻게') || 
                              teacherText.includes('뭐야') ||
                              teacherText.includes('알지') ||
                              teacherText.includes('기억나') ||
                              teacherText.includes('뭐지');
            
            const isUncertain = studentText.includes('음') || 
                                studentText.includes('어') ||
                                studentText.includes('모르') ||
                                studentText.includes('잘 모르') ||
                                studentText.length < 5 ||
                                (studentText.includes('아니') && !studentText.includes('맞아')) ||
                                studentText.includes('틀렸') ||
                                studentText.includes('헷갈');
            
            if (isQuestion && isUncertain) {
              missedParts.push({
                question: current.text,
                studentResponse: next.text,
              });
            }
          }
        }
      }
    } else {
      if (isDevelopment) {
        console.error('[lecture/summary] STT 텍스트 로드 실패:', sttPromise.reason);
      }
    }

    // 이미지 처리 (병렬로 이미 로드됨)
    let images: string[] = imagesPromise.status === 'fulfilled' ? imagesPromise.value : [];
    let sttImageRefs: string[] = [];
    
    if (sttText && fullConversation) {
      sttImageRefs = fullConversation
        .map((conv) => conv.imageRef)
        .filter((ref): ref is string => !!ref && typeof ref === 'string');
      
      if (isDevelopment) {
        console.log(`[lecture/summary] 📸 STT에서 발견된 이미지 참조: ${sttImageRefs.length}개`);
      }
    }
    
    // STT 이미지 참조 우선 처리
    if (sttImageRefs.length > 0 && images.length > 0) {
      const sttImages = sttImageRefs
        .map((ref: string) => images.find((url: string) => url.includes(ref) || ref.includes(url.split('/').pop() || '')))
        .filter((url): url is string => !!url);
      
      const remainingImages = images.filter((url: string) => !sttImages.includes(url));
      images = [...sttImages, ...remainingImages];
      
      if (isDevelopment) {
        console.log(`[lecture/summary] 📸 STT에서 활용된 이미지 ${images.length}개 사용 (STT 참조: ${sttImageRefs.length}개)`);
      }
    } else if (images.length > 0 && isDevelopment) {
      console.log(`[lecture/summary] 📸 교재 이미지 ${images.length}개 발견 (STT 참조 없음, 전체 사용)`);
    }

    if (!sttText && images.length === 0) {
      return NextResponse.json(
        { error: 'STT 텍스트와 교재 이미지가 모두 없습니다.' },
        { status: 400 }
      );
    }

    // 요약본 생성에 사용될 데이터 요약 로그 (개발 환경에서만 상세 로그)
    if (isDevelopment) {
      console.log('\n[lecture/summary] ========================================');
      console.log('[lecture/summary] 📋 요약본 생성 데이터 요약');
      console.log('[lecture/summary] ========================================');
      console.log(`[lecture/summary] Room ID: ${roomId}`);
      console.log(`[lecture/summary] 과목: ${subject}`);
      console.log(`[lecture/summary] 수업 날짜: ${tutoringDatetime ? new Date(tutoringDatetime).toLocaleString('ko-KR') : '없음'}`);
      console.log(`[lecture/summary] STT 텍스트: ${sttText ? `있음 (${sttText.length}자)` : '없음'}`);
      console.log(`[lecture/summary] 교재 이미지: ${images.length}개`);
      if (sttText) {
        const sttPreview = sttText.length > 200 ? sttText.substring(0, 200) + '...' : sttText;
        console.log(`[lecture/summary] STT 미리보기:\n${sttPreview.split('\n').slice(0, 5).join('\n')}...`);
      }
      console.log('[lecture/summary] ========================================\n');
    }

    // 4. AI로 요약본 생성
    // apiKey와 genAI는 이미 위에서 초기화됨
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.5,
        responseMimeType: 'application/json', // JSON 형식 강제
      },
    });

    // 프롬프트 생성
    const displayName = studentNickname || studentName || null;
    const prompt = `당신은 서울대 자습관리 선생님 유은서 선생님입니다. ${displayName ? `${displayName}이(가) 방금 끝난 수업` : '방금 끝난 수업'}의 내용을 정확히 정리해서, ${displayName ? `${displayName}이(가)` : '학생이'} 이 요약본만 보면 수업을 다 한눈에 볼 수 있도록 완벽하게 정리해주세요.

**유은서 쌤의 말투 규칙 (랑쌤/준쌤 페르소나 참고):**
- 친근하고 따뜻한 반말 사용 ("~야", "~지", "~해", "~거야")
- "불안해하지 마, 이것만 꼭 기억해!" 같은 격려하는 톤
- "아까 네가 대답 못 했던 그 문제"처럼 구체적으로 언급
- "10분만 투자하면 4배 효과" 같은 효율 강조
- 랑쌤/준쌤처럼 친근하고 상냥하게, 학생을 친구처럼 대하면서도 선생님답게
- 이름을 부를 때는 **성 없이 이름만** 부르기 (예: "소유찬" → "유찬아", "김철수" → "철수야")
${displayName ? `- ${displayName}아(야)라고 직접 이름을 불러주기 (자연스럽게, 성 없이 이름만)` : ''}

**학생 정보:**
${studentName ? `- 이름: ${studentName}` : ''}
${studentId ? `- 학생 ID: ${studentId}` : ''}

**과목:** ${subject}
${tutoringDatetime ? `**수업 날짜:** ${new Date(tutoringDatetime).toLocaleDateString('ko-KR')}\n` : ''}

${sttText ? `**수업 대화 내용 (STT):**\n${sttText}\n\n` : ''}
${missedParts.length > 0 ? `**학생이 놓친 부분 (STT 분석):**\n${missedParts.map((m, idx) => `${idx + 1}. 선생님: "${m.question}" → 학생: "${m.studentResponse}"`).join('\n')}\n\n` : ''}
${images.length > 0 ? `**교재 이미지:** ${images.length}개 이미지가 제공됩니다.

${!sttText ? `⚠️ **중요:** STT가 없으므로 이미지만으로 수업 내용을 파악해야 합니다.

**이미지 필터링 및 분석 가이드:**

0. **관련 없는 이미지 제거 (최우선):**
   - 수업과 관련 없는 이미지는 **완전히 무시**해야 합니다
   - 카카오톡 대화, 개인 사진, 다른 과목 이미지, 배경 화면 등은 요약에 포함하지 마세요
   - 오직 **교재/문제집/수업 자료 이미지**만 사용하세요
   - 관련 없는 이미지가 섞여 있어도, 수업 내용에 해당하는 이미지만 참고하여 요약을 생성하세요

1. **이미지 타입 판단:**
   - **개념 중심**: 표, 그래프, 개념 설명, 정의, 공식이 많음
   - **문제 중심**: 문제집/시험지 패턴 (문제 번호, 선택지, 빈칸, 답지 없음)
   - **개념 + 예제**: 개념 설명과 함께 예제 문제 포함 (예제 번호, 해설 포함)

2. **문제 vs 예제 구분:**
   - **실제 문제 (반드시 포함)**: 문제집/시험지/워크북 형태
     - 문제 번호와 선택지/빈칸이 명확함
     - 답지나 해설이 없거나 별도 페이지
     - 학생이 직접 풀어야 하는 문제
   - **개념 내 예제 (선택적)**: 개념서/교과서의 예제
     - "예제 1", "예제 2" 같은 번호
     - 해설이나 풀이가 함께 있음
     - 개념 설명의 일부로 사용됨
     - → 개념 정리가 목적이면 예제는 생략 가능

3. **요약 생성 기준:**
   - **실제 문제가 있으면**: 반드시 문제를 포함한 복습 내용 생성 (문제 없으면 복습 의미가 떨어짐)
   - **개념만 있으면**: 핵심 개념 정리 중심으로 요약
   - **개념 + 예제만 있으면**: 개념 정리 중심, 예제는 참고만 (생략 가능)

이미지를 모두 확인하여 **수업과 관련 있는 이미지만** 선택하고, 어떤 수업을 했는지 파악한 후 실제 문제가 있는지 예제만 있는지 구분하여 요약을 생성하세요.\n\n` : `교재의 표, 그림, 핵심 개념, 문제를 확인하세요.\n\n`}` : ''}

**콘텐츠 구조 - 핵심만 간결하게, 하지만 한 페이지로 복기 가능하도록:**

1. **제목**: "[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]" 스타일

2. **쌤의 한마디** (도입부 - 간결하게):
   ${displayName ? `- "${displayName}아, 아까 쌤이 [핵심 개념] 설명할 때 목소리 엄청 커지셨지? 시험에 무조건 나온대."` : '- "아까 쌤이 [핵심 개념] 설명할 때 목소리 엄청 커지셨지? 시험에 무조건 나온대."'}
   - "오늘 딱 10분만 투자해서 4배 효과 챙겨가자!"
   - STT에서 선생님이 강조한 핵심 부분만 언급 (너무 길지 않게)
   - 수업 중 선생님이 말한 핵심 표현이나 예시만 포함

3. **이것만 꼭 알아둬!** (핵심 개념 정리 - 수업에서 실제로 다룬 것만):
   - 수업에서 **정말로 다룬 핵심 개념들**만 선별하여 정리 (3-5개 정도)
   - 각 개념을 간결하게, 하지만 이해할 수 있게 정리 (너무 짧지 않게, 너무 길지 않게)
   - 교재 이미지의 핵심 표/그림만 언급 ("아까 쌤이 엄청 강조하셨던 이 표, 기억하지?")
   - 수업 중 나온 핵심 예시나 비유만 포함
   - 각 개념마다 핵심 포인트 1-2줄로 정리
   - 수업 중 다룬 문제 중에서 가장 중요한 것만 언급

4. **📖 오늘 수업 핵심 정리** (수업 흐름의 핵심만):
   - 수업 시작부터 끝까지의 **핵심 흐름**만 정리 (모든 내용을 다루지 말고, 정말 중요한 것만)
   - 선생님이 **강조한 핵심 설명**만 포함
   - 풀었던 문제 중에서 **가장 중요한 문제**만 언급
   - 선생님이 **반드시 기억하라고 한 포인트**만 정리
   - "쌤이 이렇게 설명하셨지?" 같은 구체적인 언급은 핵심만
   - **한 페이지 분량**: 너무 짧지 않게, 하지만 한 눈에 보기 좋게 (A4 한 장 분량 고려)

5. **⚠️ 아까 ${displayName ? displayName : '네가'} 놓친 부분** (STT 분석 기반 - 핵심만):
   ${missedParts.length > 0 ? `
   - 학생이 대답 못했거나 오답한 **핵심 구간**만 정확히 짚어주기 (모든 놓친 부분을 다루지 말고)
   ${displayName ? `- "${displayName}아, 아까 쌤이 [질문] 했을 때 바로 대답 못 했지?"` : '- "아까 쌤이 [질문] 했을 때 바로 대답 못 했지?"'}
   - 정답과 이유를 핵심만 간결하게 설명 (너무 길지 않게)
   - "그때 쌤이 이거 헷갈리면 등급 깎인다고 하셨으니까 지금 확실히 외우자!"
   - 각 놓친 부분에 대해 수업 중 선생님이 한 핵심 설명만 반영
   ` : `
   - STT 분석 결과 놓친 부분이 없으면 이 섹션은 생략
   `}

6. **🎯 오늘의 미션** (행동 유도):
   ${displayName ? `- "${displayName}아, 자기 전에 위 표 한 번만 더 보고, [핵심 문장] 세 번 읽고 자기! (10초 컷!)"` : '- "자기 전에 위 표 한 번만 더 보고, [핵심 문장] 세 번 읽고 자기! (10초 컷!)"'}
   - 간단하고 실행 가능한 미션
   - 수업 중 선생님이 내준 숙제나 다음 시간 준비사항이 있으면 포함

**요구사항 (매우 중요):**
- **핵심만, 하지만 한 페이지로 복기 가능하게**: 이 요약본만 보면 수업의 핵심을 다시 한 번 복기할 수 있어야 함
- 한 페이지, 10분 안에 읽을 수 있는 분량 (A4 한 장 기준)
- **수업에서 정말로 다룬 핵심 내용만** 포함 (모든 내용을 다루지 말고, 중요한 것만 선별)
- STT에서 선생님이 **강조한 핵심 설명**만 반영 (모든 설명을 다 담지 말고)
- 교재 이미지의 **핵심 표/그림/문제**만 언급 (모든 이미지 내용을 다 설명하지 말고)
- 수업 중 풀었던 문제 중에서 **가장 중요한 문제**만 언급
- **너무 짧지 않게, 너무 길지 않게**: 한 페이지 분량으로, 핵심이 빠지지 않도록
- ${displayName ? `${displayName}아(야)라고 이름을 자연스럽게 부르며 개인화 (성 없이 이름만)` : '학생을 직접적으로 언급하며 개인화'}
- "투입 절반, 효과 4배" 같은 효율 메시지 자연스럽게 포함
- **선별과 집중**: 모든 것을 담으려 하지 말고, 정말 중요한 것만, 하지만 그 중요한 것들은 충분히 설명

**출력 형식 (순수 JSON만 - 코드 블록(\`\`\`) 없이 바로 JSON 객체로 응답):**
{
  "title": "[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]",
  "teacherMessage": "쌤의 한마디 (도입부, 격려 메시지, ${displayName ? `${displayName}아(야)라고 이름 부르기 (성 없이 이름만)` : '학생 이름 언급'})",
  "unitTitle": "UNIT 01. [단원명]",
  "conceptSummary": "이것만 꼭 알아둬! (수업에서 정말로 다룬 핵심 개념만 선별하여 정리, 각각 2-3줄 정도, 3-5개 정도, 너무 짧지 않게)",
  "detailedContent": "📖 오늘 수업 핵심 정리 (수업 흐름의 핵심만, 선생님이 강조한 핵심 설명과 가장 중요한 문제만 언급, 한 페이지 분량으로 적절하게)",
  "textbookHighlight": "교재 강조 부분 (핵심 표/그림만 언급, '아까 쌤이 엄청 강조하셨던 이 표, 기억하지?' 스타일, 간결하게)",
  "missedParts": ${missedParts.length > 0 ? `[
    {
      "question": "선생님이 한 핵심 질문 (가장 중요한 것만)",
      "studentResponse": "학생의 대답 (또는 대답 못함)",
      "correctAnswer": "정답",
      "explanation": "왜 이게 정답인지 핵심만 설명 (간결하게)"
    }
  ]` : '[]'},
  "todayMission": "오늘의 미션 (간단한 행동 유도, 예: '자기 전에 위 표 한 번만 더 보고, Dinner is being cooked 세 번 읽고 자기! (10초 컷!)')",
  "encouragement": "마무리 격려 메시지 (예: '벌써 다 봤어? 역시 빠르네! 이 기세로 숙제 시간도 반으로 확 줄여버리자.')"
}

**매우 중요**: 
- \`\`\`json이나 \`\`\` 같은 코드 블록 마커를 절대 사용하지 마세요
- 바로 { 로 시작해서 } 로 끝나는 순수 JSON 객체만 응답하세요
- 문자열 내부의 줄바꿈은 \\n으로 표현하세요`;

    // 🎯 STT 기반 이미지 관련성 분석 및 선택 (최적화: 이미지 캐싱)
    let imagesToUse: string[] = [];
    const imageCache = new Map<string, { buffer: Buffer; mimeType: string }>(); // 이미지 다운로드 캐시
    
    if (images.length > 0 && sttText) {
      console.log(`[lecture/summary] 🔍 STT 기반 이미지 관련성 분석 시작 (${images.length}개 이미지)...`);
      
      // STT 요약 및 개념 키워드 캐싱 (최적화: 루프 밖에서 한 번만 계산)
      const sttSummary = sttText.length > 1000 
        ? sttText.substring(0, 1000) + '...'
        : sttText;
      
      const conceptPatterns = [
        /(관계대명사|관계부사|감각동사|수여동사|to부정사|동명사|분사|현재분사|과거분사)/gi,
        /(\w+법칙|\w+정리|\w+공식|\w+원리)/gi,
        /(\w+함수|\w+방정식|\w+부등식)/gi,
        /(\w+장|\w+절|\w+단원)/gi,
      ];
      const mentionedConcepts: string[] = [];
      for (const pattern of conceptPatterns) {
        const matches = sttSummary.match(pattern);
        if (matches) {
          mentionedConcepts.push(...matches);
        }
      }
      const conceptKeywords = mentionedConcepts.length > 0 
        ? `\n**STT에서 언급된 개념 키워드:** ${[...new Set(mentionedConcepts)].slice(0, 10).join(', ')}`
        : '';
      
      const relevancePrompt = `이 이미지는 수업 중에 사용된 교재/문제집 페이지입니다.

**수업 대화 내용 (STT):**
${sttSummary}${conceptKeywords}

이 이미지가 위 수업 대화 내용과 관련이 있는지 판단해주세요.

**판단 기준:**
1. 이미지에 있는 개념/문제가 STT에서 논의되었는지 (예: STT에서 "관계대명사 배워볼게!"라고 했으면, 관계대명사 개념 페이지 이미지는 관련성 높음)
2. 이미지의 표/그래프/그림이 STT에서 언급되었는지
3. 이미지의 문제 번호가 STT에서 다뤄졌는지
4. STT에서 언급된 개념 키워드가 이미지에 포함되어 있는지 (예: "관계대명사" 키워드가 STT에 있으면, 관계대명사 개념/문제가 있는 이미지는 관련성 높음)

**응답 형식 (JSON만):**
{
  "relevant": true/false,
  "score": 0-100,
  "reason": "관련성 이유 (간단히)"
}

- relevant: true면 관련 있음, false면 관련 없음
- score: 관련성 점수 (0-100, 높을수록 관련성 높음)
- reason: 왜 관련이 있는지/없는지 간단히 설명 (한 문장)`;
      
      try {
        const imagesToAnalyze = images; // STT 관련 이미지는 모두 분석
        const analysisModel = genAI.getGenerativeModel({
          model: 'gemini-2.5-pro',
          safetySettings: GEMINI_SAFETY_SETTINGS,
        });
        
        // 🚀 최적화 2: 이미지 다운로드를 병렬 처리
        const imageDownloadPromises = imagesToAnalyze.map(async (imageUrl) => {
          let imageData = imageCache.get(imageUrl);
          if (!imageData) {
            const downloaded = await downloadAndConvertImage(imageUrl);
            if (!downloaded) return null;
            imageData = downloaded;
            imageCache.set(imageUrl, imageData);
          }
          return { url: imageUrl, imageData };
        });
        
        const downloadedImages = (await Promise.all(imageDownloadPromises))
          .filter((item): item is { url: string; imageData: { buffer: Buffer; mimeType: string } } => item !== null);
        
        // 🚀 최적화 3: 이미지 관련성 분석을 병렬 처리
        const analysisPromises = downloadedImages.map(async ({ url, imageData }) => {
          try {
            const analysisResult = await analysisModel.generateContent({
              contents: [{
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      data: imageData.buffer.toString('base64'),
                      mimeType: imageData.mimeType,
                    },
                  },
                  { text: relevancePrompt },
                ],
              }],
            });

            const analysisText = analysisResult.response.text();
            const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
              const analysis = JSON.parse(jsonMatch[0]);
              if (analysis.relevant && analysis.score > 30) {
                if (isDevelopment) {
                  console.log(`[lecture/summary]   ✅ 이미지 관련성: ${analysis.score}점 - ${analysis.reason?.substring(0, 50)}...`);
                }
                return {
                  url,
                  score: analysis.score || 50,
                  reason: analysis.reason || '관련성 분석 완료',
                };
              }
            }
            return null;
          } catch (imgAnalysisErr) {
            if (isDevelopment) {
              console.warn(`[lecture/summary] 이미지 분석 실패 (${url.substring(0, 50)}...):`, imgAnalysisErr);
            }
            return null;
          }
        });
        
        const imageScores = (await Promise.all(analysisPromises))
          .filter((item): item is { url: string; score: number; reason: string } => item !== null);
        
        imageScores.sort((a, b) => b.score - a.score);
        // STT 관련 이미지는 점수 40 이상인 모든 이미지 사용 (개수 제한 없음)
        imagesToUse = imageScores
          .filter(img => img.score >= 40)
          .map(img => img.url);
        
        if (imagesToUse.length === 0) {
          imagesToUse = [images[0]];
          console.log(`[lecture/summary] ⚠️ 관련 이미지 없음, 첫 번째 이미지 사용 (fallback)`);
        } else {
          console.log(`[lecture/summary] ✅ STT 관련 이미지 ${imagesToUse.length}개 선택 완료`);
        }
      } catch (analysisErr) {
        console.error('[lecture/summary] 이미지 관련성 분석 중 오류:', analysisErr);
        imagesToUse = [images[0]];
        console.log(`[lecture/summary] ⚠️ 분석 실패, 첫 번째 이미지 사용 (fallback)`);
      }
    } else if (images.length > 0) {
      // STT가 없을 때도 모든 이미지 사용 (개수 제한 없음)
      imagesToUse = images;
      console.log(`[lecture/summary] 🖼️ STT 없음, 이미지 ${imagesToUse.length}개 사용 (전체 활용)`);
    }

    // 프롬프트와 선택된 이미지를 parts에 추가 (최적화: 캐시된 이미지 재사용)
    const parts: any[] = [{ text: prompt }];
    
    if (imagesToUse.length > 0) {
      // 🚀 최적화 4: 최종 이미지 다운로드도 병렬 처리 (캐시에 없는 경우만)
      const finalImagePromises = imagesToUse.map(async (imageUrl) => {
        let imageData = imageCache.get(imageUrl);
        if (!imageData) {
          const downloaded = await downloadAndConvertImage(imageUrl);
          if (!downloaded) return null;
          imageData = downloaded;
          imageCache.set(imageUrl, imageData);
        }
        return {
          inlineData: {
            data: imageData.buffer.toString('base64'),
            mimeType: imageData.mimeType,
          },
        };
      });
      
      const imageParts = (await Promise.all(finalImagePromises))
        .filter((part): part is { inlineData: { data: string; mimeType: string } } => part !== null);
      
      parts.push(...imageParts);
      
      if (isDevelopment) {
        console.log(`[lecture/summary] ✅ 이미지 ${imageParts.length}개 변환 완료`);
      }
    } else {
      if (isDevelopment) {
        console.log('[lecture/summary] ⚠️ 이미지 없음 - 텍스트만으로 요약본 생성');
      }
    }
    
    if (isDevelopment) {
      console.log(`[lecture/summary] 📤 Gemini API 호출 시작 (프롬프트 길이: ${prompt.length}자, 이미지: ${imagesToUse.length}개)`);
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const responseText = result.response.text();
    
    if (isDevelopment) {
      console.log(`[lecture/summary] ✅ Gemini 응답 수신 (길이: ${responseText.length}자)`);
      console.log(`[lecture/summary] 📝 응답 미리보기:\n${responseText.substring(0, 300)}...`);
    }
    
    // JSON 파싱 (강화된 로직)
    let summaryData: any = null;
    try {
      // 1단계: 모든 코드 블록 마커 제거 (여러 번 시도)
      let cleanedText = responseText
        // 코드 블록 시작 마커 제거 (여러 패턴)
        .replace(/^```json\s*/gim, '')
        .replace(/^```\s*/gim, '')
        // 코드 블록 끝 마커 제거
        .replace(/\s*```$/gim, '')
        .replace(/```/g, '') // 남은 모든 ``` 제거
        .trim();
      
      console.log('[lecture/summary] 📝 정리된 응답 미리보기:', cleanedText.substring(0, 200));
      
      // 2단계: 직접 파싱 시도
      try {
        summaryData = JSON.parse(cleanedText);
        console.log('[lecture/summary] ✅ JSON 직접 파싱 성공');
      } catch (directParseErr) {
        console.log('[lecture/summary] 직접 파싱 실패, JSON 추출 시도...');
        
        // 3단계: JSON 객체 추출 시도 (가장 바깥쪽 { } 찾기)
        let braceCount = 0;
        let startIdx = -1;
        let endIdx = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < cleanedText.length; i++) {
          const char = cleanedText[i];
          
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
          
          if (!inString) {
            if (char === '{') {
              if (braceCount === 0) startIdx = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && startIdx !== -1) {
                endIdx = i;
                break;
              }
            }
          }
        }
        
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonStr = cleanedText.substring(startIdx, endIdx + 1);
          console.log('[lecture/summary] 추출된 JSON 길이:', jsonStr.length);
          
          try {
            summaryData = JSON.parse(jsonStr);
            console.log('[lecture/summary] ✅ JSON 추출 후 파싱 성공');
          } catch (innerErr) {
            // 4단계: 정리 후 시도
            const cleanedJson = jsonStr
              .replace(/,\s*}/g, '}')
              .replace(/,\s*]/g, ']')
              .replace(/\n/g, '\\n') // 실제 줄바꿈을 이스케이프
              .replace(/\r/g, '');
            
            try {
              summaryData = JSON.parse(cleanedJson);
              console.log('[lecture/summary] ✅ JSON 정리 후 파싱 성공');
            } catch (finalErr) {
              // 5단계: 마지막 시도 - 문자열 내부 줄바꿈 처리
              // JSON 문자열 값 내부의 실제 줄바꿈을 공백으로 변환
              let fixedJson = jsonStr;
              let result = '';
              let inStr = false;
              let escape = false;
              
              for (let i = 0; i < fixedJson.length; i++) {
                const ch = fixedJson[i];
                if (escape) {
                  result += ch;
                  escape = false;
                  continue;
                }
                if (ch === '\\') {
                  result += ch;
                  escape = true;
                  continue;
                }
                if (ch === '"') {
                  inStr = !inStr;
                  result += ch;
                  continue;
                }
                if (inStr && (ch === '\n' || ch === '\r')) {
                  result += ' '; // 문자열 내부 줄바꿈을 공백으로
                  continue;
                }
                result += ch;
              }
              
              summaryData = JSON.parse(result);
              console.log('[lecture/summary] ✅ JSON 문자열 내부 줄바꿈 처리 후 파싱 성공');
            }
          }
        } else {
          throw new Error('JSON 객체를 찾을 수 없음');
        }
      }
      
      if (isDevelopment && summaryData) {
        console.log(`[lecture/summary] 📊 요약본 구조:`);
        console.log(`[lecture/summary]   - 제목: ${summaryData.title || '없음'}`);
        console.log(`[lecture/summary]   - 쌤의 한마디: ${summaryData.teacherMessage ? '있음' : '없음'}`);
        console.log(`[lecture/summary]   - UNIT 제목: ${summaryData.unitTitle || '없음'}`);
        console.log(`[lecture/summary]   - 개념 요약: ${summaryData.conceptSummary ? '있음' : '없음'}`);
        console.log(`[lecture/summary]   - 교재 강조: ${summaryData.textbookHighlight ? '있음' : '없음'}`);
        console.log(`[lecture/summary]   - 놓친 부분: ${summaryData.missedParts?.length || 0}개`);
        console.log(`[lecture/summary]   - 오늘의 미션: ${summaryData.todayMission ? '있음' : '없음'}`);
        console.log(`[lecture/summary]   - 격려 메시지: ${summaryData.encouragement ? '있음' : '없음'}`);
      }
    } catch (parseErr) {
      console.error('[lecture/summary] ❌ JSON 파싱 실패:', parseErr);
      console.log('[lecture/summary] 📝 파싱 실패로 인해 기본 구조로 생성');
      // 기본 구조 생성 - 파싱 실패 시에도 동작하도록
      summaryData = {
        title: '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]',
        teacherMessage: '오늘 수업 고생 많았어! 아래 정리된 내용만 꼭 기억해 둬.',
        unitTitle: subject || '오늘 배운 내용',
        conceptSummary: responseText.substring(0, 500) + '...',
        summary: responseText,
        keyPoints: [],
        rememberThis: '',
        encouragement: '오늘도 열심히 공부한 너, 정말 대단해!',
        todayMission: '오늘 배운 핵심 개념 한 번 더 읽어보기!',
      };
    }
    
    // summaryData가 여전히 null인 경우 기본값 설정
    if (!summaryData) {
      console.warn('[lecture/summary] ⚠️ summaryData가 null - 기본 구조 생성');
      summaryData = {
        title: '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]',
        teacherMessage: '오늘 수업 고생 많았어! 아래 정리된 내용만 꼭 기억해 둬.',
        unitTitle: subject || '오늘 배운 내용',
        conceptSummary: responseText.substring(0, 500) + '...',
        summary: responseText,
        keyPoints: [],
        rememberThis: '',
        encouragement: '오늘도 열심히 공부한 너, 정말 대단해!',
        todayMission: '오늘 배운 핵심 개념 한 번 더 읽어보기!',
      };
    }
    
    // 문자열 필드가 JSON 문자열인 경우 파싱 (Gemini가 중첩 JSON을 반환하는 경우 대비)
    const stringFields = ['conceptSummary', 'textbookHighlight', 'teacherMessage', 'todayMission', 'encouragement', 'detailedContent'];
    for (const field of stringFields) {
      if (summaryData[field] && typeof summaryData[field] === 'string') {
        const value = summaryData[field].trim();
        // JSON 문자열인지 확인 (시작이 { 또는 [로 시작하고 끝이 } 또는 ]로 끝나는 경우)
        if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            // 파싱된 값이 객체나 배열이면 원본 문자열 유지 (의도하지 않은 파싱 방지)
            // 단순 문자열이면 파싱된 값 사용
            if (typeof parsed === 'string') {
              summaryData[field] = parsed;
            }
          } catch {
            // JSON 파싱 실패 시 원본 문자열 유지
          }
        }
      }
    }

    // 5. 요약본 저장
    const reviewPrograms = await Collections.reviewPrograms();
    const now = new Date();
    
    const reviewContent: any = {
      mode: 'concept' as const,
      summary: summaryData.summary || '',
      teacherMessage: summaryData.teacherMessage || '',
      unitTitle: summaryData.unitTitle || '',
      conceptSummary: summaryData.conceptSummary || '',
      detailedContent: summaryData.detailedContent || '', // 수업 상세 정리
      textbookHighlight: summaryData.textbookHighlight || '',
      missedParts: summaryData.missedParts || [],
      todayMission: summaryData.todayMission || '',
      encouragement: summaryData.encouragement || '',
      keyPoints: summaryData.keyPoints || [],
      rememberThis: summaryData.rememberThis || '',
      keyPointsList: (summaryData.keyPoints || []).map((point: string, idx: number) => ({
        title: point,
        content: point,
      })),
      sttData: sttText ? {
        fullText: sttText,
        conversations: fullConversation || [],
        imageRefs: sttImageRefs,
      } : null,
      imagesInOrder: images,
    };

    const reviewProgram = {
      studentId: studentId || 'unknown',
      studentName: studentName || null,
      studentNickname: studentNickname || null,
      title: summaryData.title || '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]',
      subject: subject,
      reviewContent,
      intent: 'review' as const,
      startAt: now,
      createdAt: now,
      updatedAt: now,
      originalSessionId: roomId,
      metadata: {
        roomId,
        tutoringDatetime,
        imageCount: images.length,
        imageUrls: images,
        hasStt: !!sttText,
        missedPartsCount: missedParts.length,
        isSecretNote: true,
      },
    };

    const insertResult = await reviewPrograms.insertOne(reviewProgram as any);
    
    // 개발 환경에서만 상세 로그 출력 (최적화)
    if (isDevelopment) {
      console.log('\n[lecture/summary] ========================================');
      console.log('[lecture/summary] ✅ 요약본 생성 완료');
      console.log('[lecture/summary] ========================================');
      console.log(`[lecture/summary] Review Program ID: ${insertResult.insertedId.toString()}`);
      console.log(`[lecture/summary] 저장된 데이터:`);
      console.log(`[lecture/summary]   - Room ID: ${roomId}`);
      console.log(`[lecture/summary]   - 과목: ${subject}`);
      console.log(`[lecture/summary]   - STT 사용: ${sttText ? '예' : '아니오'}`);
      console.log(`[lecture/summary]   - 이미지 사용: ${images.length}개`);
      console.log(`[lecture/summary]   - 사용된 이미지: ${imagesToUse.length > 0 ? imagesToUse[0].substring(0, 80) + '...' : '없음'}`);
      console.log(`[lecture/summary]   - 놓친 부분 분석: ${missedParts.length}개`);
      
      console.log('\n[lecture/summary] 🧪 개발 도구 - 상세 정보:');
      console.log('[lecture/summary] ========================================');
      
      if (fullConversation.length > 0) {
        console.log('[lecture/summary] 📝 STT 대화 내용:');
        console.log('[lecture/summary] 전체 대화 수:', fullConversation.length);
        
        const conversationText = fullConversation
          .map((conv: any, idx: number) => {
            const speaker = conv.speaker || 'unknown';
            const text = conv.text || '';
            const timestamp = conv.timestamp || '';
            const imageRef = conv.imageRef || '';
            return `[${idx + 1}] [${speaker}]${timestamp ? ` (${timestamp})` : ''}${imageRef ? ` [이미지: ${imageRef}]` : ''}\n   ${text}`;
          })
          .join('\n\n');
        
        console.log(conversationText);
        console.log('\n[lecture/summary] 📋 STT 원본 데이터 (객체):');
        console.log(fullConversation);
        
        if (sttText) {
          console.log('\n[lecture/summary] 📄 STT 텍스트 (문자열):');
          console.log(sttText);
        }
      } else if (sttText) {
        console.log('[lecture/summary] 📝 STT 텍스트:');
        console.log(sttText);
      } else {
        console.log('[lecture/summary] 📝 STT 내용: 없음');
      }
      
      if (images.length > 0) {
        console.log('\n[lecture/summary] 🖼️ 사용된 이미지 링크:');
        images.forEach((url, idx) => {
          console.log(`[lecture/summary]   ${idx + 1}. ${url}`);
        });
        
        console.log('\n[lecture/summary] 🔗 이미지 링크 (브라우저에서 열기):');
        images.forEach((url, idx) => {
          console.log(`%c${idx + 1}. 이미지 ${idx + 1}`, 'color: #4fc3f7; text-decoration: underline; cursor: pointer;', url);
        });
      } else {
        console.log('[lecture/summary] 🖼️ 사용된 이미지: 없음');
      }
      
      if (imagesToUse.length > 0) {
        console.log('\n[lecture/summary] 📤 Gemini에 전달된 이미지:');
        imagesToUse.forEach((url, idx) => {
          console.log(`[lecture/summary]   ${idx + 1}. ${url}`);
          console.log(`%c   → 이미지 ${idx + 1} (Gemini 전달)`, 'color: #29b6f6; text-decoration: underline; cursor: pointer;', url);
        });
      }
      
      const reviewProgramUrl = `${req.nextUrl.origin}/review-programs/${insertResult.insertedId.toString()}`;
      console.log('\n[lecture/summary] 📚 Review Program 확인:');
      console.log(`%c   ${reviewProgramUrl}`, 'color: #4fc3f7; text-decoration: underline; cursor: pointer;');
      console.log(`[lecture/summary]   Review Program ID: ${insertResult.insertedId.toString()}`);
      
      console.log('[lecture/summary] ========================================\n');
    }

    // summaryData 검증 및 기본값 설정
    if (!summaryData) {
      summaryData = {
        title: '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]',
        teacherMessage: '',
        unitTitle: '',
        conceptSummary: '',
        detailedContent: '',
        textbookHighlight: '',
        missedParts: [],
        todayMission: '',
        encouragement: '',
      };
    }

    return NextResponse.json({
      success: true,
      reviewProgramId: insertResult.insertedId.toString(),
      summary: summaryData,
      roomId,
      studentId: studentId || null,
      studentName: studentName || null,
      studentNickname: studentNickname || null,
    });
  } catch (error: any) {
    console.error('[lecture/summary] ❌ Error:', error);
    console.error('[lecture/summary] Error stack:', error?.stack);
    console.error('[lecture/summary] Error message:', error?.message);
    console.error('[lecture/summary] Error name:', error?.name);
    
    const errorMessage = error?.message || '요약본 생성 중 오류가 발생했습니다.';
    const isClientError = errorMessage.includes('필요') || 
                         errorMessage.includes('없습니다') || 
                         errorMessage.includes('실패') ||
                         errorMessage.includes('찾을 수 없습니다');
    
    // 개발 환경에서는 더 상세한 에러 정보 제공
    const errorResponse: any = {
      error: errorMessage,
      status: isClientError ? 400 : 500,
    };
    
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error?.stack;
      errorResponse.errorName = error?.name;
      errorResponse.errorType = error?.constructor?.name;
    }
    
    return NextResponse.json(
      errorResponse,
      { status: isClientError ? 400 : 500 }
    );
  }
}
