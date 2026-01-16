import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Collections } from '@/lib/db';
import { loadCorrectAndParseStt, type Conversation } from '@/lib/stt-utils';
import { getSubjectGuide } from '@/lib/prompts/subjectPrompts';
import { buildSummaryPrompt } from '@/lib/prompts/summaryPrompt';

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

type SummaryCacheData = {
  version: 1;
  roomId: string;
  cachedAt: string;
  subject: string;
  tutoringDatetime: string | null;
  studentId: string | null;
  studentName: string | null;
  studentNickname: string | null;
  sttText: string | null;
  fullConversation: Conversation[];
  missedParts: Array<{ question: string; studentResponse?: string; correctAnswer?: string; explanation?: string }>;
  images: string[];
  sttImageRefs: string[];
  imagesToUse: string[];
};

const SUMMARY_CACHE_DIR = path.join(process.cwd(), '.cache', 'lecture-summary');

async function loadSummaryCache(roomId: string): Promise<SummaryCacheData | null> {
  try {
    const cachePath = path.join(SUMMARY_CACHE_DIR, `${roomId}.json`);
    const raw = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.roomId !== roomId) return null;
    return parsed as SummaryCacheData;
  } catch {
    return null;
  }
}

async function saveSummaryCache(roomId: string, data: SummaryCacheData): Promise<void> {
  await fs.mkdir(SUMMARY_CACHE_DIR, { recursive: true });
  const cachePath = path.join(SUMMARY_CACHE_DIR, `${roomId}.json`);
  await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
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
    const { roomId, grade, testMode } = body;

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
    const isTestMode =
      Boolean(testMode) && (isDevelopment || process.env.ENABLE_SUMMARY_TEST_MODE === 'true');

    let subject = '미분류';
    let tutoringDatetime: string | null = null;
    let studentId: string | null = null;
    let studentName: string | null = null;
    let studentNickname: string | null = null;
    let sttText: string | null = null;
    let missedParts: Array<{ question: string; studentResponse?: string; correctAnswer?: string; explanation?: string }> = [];
    let fullConversation: Conversation[] = [];
    let images: string[] = [];
    let sttImageRefs: string[] = [];
    let imagesToUse: string[] = [];
    let usedCache = false;

    if (isTestMode) {
      const cached = await loadSummaryCache(roomId);
      if (cached) {
        usedCache = true;
        subject = cached.subject || subject;
        tutoringDatetime = cached.tutoringDatetime || null;
        studentId = cached.studentId || null;
        studentName = cached.studentName || null;
        studentNickname = cached.studentNickname || null;
        sttText = cached.sttText || null;
        fullConversation = cached.fullConversation || [];
        missedParts = cached.missedParts || [];
        images = cached.images || [];
        sttImageRefs = cached.sttImageRefs || [];
        imagesToUse = cached.imagesToUse || [];

        if (isDevelopment) {
          console.log(`[lecture/summary] 🧪 테스트 모드 캐시 사용: ${roomId}`);
        }
      }
    }

    if (!usedCache) {
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
    subject = roomMeta.subject || '미분류';
    tutoringDatetime = roomMeta.tutoring_datetime || null;

    // 학생 정보 처리
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
    if (sttPromise.status === 'fulfilled') {
      fullConversation = sttPromise.value;
      
      if (fullConversation.length > 0) {
        // 보정된 STT 텍스트 생성
        sttText = fullConversation
          .map((conv) => `[${conv.speaker}]: ${conv.text}`)
          .join('\n');

        // 학생 질문 추출 (꼽주지 않고, 궁금했던 내용 정리)
        missedParts = [];
        const isStudent = (speaker?: string) =>
          speaker === 'student' || speaker === '학생' || speaker?.includes('student') || speaker?.includes('학생');
        const isTeacher = (speaker?: string) =>
          speaker === 'teacher' || speaker === '선생님' || speaker?.includes('teacher') || speaker?.includes('선생');
        const looksLikeQuestion = (text: string) => {
          const t = text.toLowerCase();
          return (
            t.includes('?') ||
            t.includes('어떻게') ||
            t.includes('왜') ||
            t.includes('뭐야') ||
            t.includes('뭐예요') ||
            t.includes('뭔가요') ||
            t.includes('무슨') ||
            t.includes('어떤') ||
            t.includes('언제') ||
            t.includes('어디') ||
            t.includes('몇') ||
            t.includes('가능해') ||
            t.includes('되나요') ||
            t.includes('모르겠')
          );
        };

        for (let i = 0; i < fullConversation.length; i++) {
          const current = fullConversation[i];
          if (isStudent(current.speaker) && looksLikeQuestion(current.text)) {
            let teacherReply = '';
            for (let j = i + 1; j < fullConversation.length; j++) {
              if (isTeacher(fullConversation[j].speaker)) {
                teacherReply = fullConversation[j].text;
                break;
              }
            }
            missedParts.push({
              question: current.text,
              explanation: teacherReply,
            });
          }
        }
      }
    } else {
      if (isDevelopment) {
        console.error('[lecture/summary] STT 텍스트 로드 실패:', sttPromise.reason);
      }
    }

    // 이미지 처리 (병렬로 이미 로드됨)
    images = imagesPromise.status === 'fulfilled' ? imagesPromise.value : [];
    sttImageRefs = [];
    
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
    const gradeLabel = typeof grade === 'string' && grade.trim().length > 0 ? grade.trim() : null;
    const subjectGuide = getSubjectGuide(subject);
    const prompt = buildSummaryPrompt({
      displayName,
      studentName,
      studentId,
      gradeLabel,
      subject,
      subjectGuide,
      tutoringDatetime,
      sttText,
      missedParts,
      images,
    });

    // 🎯 STT 기반 이미지 관련성 분석 및 선택 (최적화: 이미지 캐싱)
    const imageCache = new Map<string, { buffer: Buffer; mimeType: string }>(); // 이미지 다운로드 캐시

    if (imagesToUse.length === 0) {
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
    } else if (isDevelopment) {
      console.log(`[lecture/summary] 🧪 테스트 모드: 캐시된 이미지 ${imagesToUse.length}개 사용`);
    }

    if (isTestMode && !usedCache) {
      await saveSummaryCache(roomId, {
        version: 1,
        roomId,
        cachedAt: new Date().toISOString(),
        subject,
        tutoringDatetime,
        studentId,
        studentName,
        studentNickname,
        sttText,
        fullConversation,
        missedParts,
        images,
        sttImageRefs,
        imagesToUse,
      });

      if (isDevelopment) {
        console.log(`[lecture/summary] 🧪 테스트 모드 캐시 저장 완료: ${roomId}`);
      }
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

    // conceptSummary/detailedContent 중복 방지 및 제목 제거
    const stripHeading = (text: string, heading: RegExp) => text.replace(heading, '').trim();
    if (summaryData.conceptSummary && typeof summaryData.conceptSummary === 'string') {
      summaryData.conceptSummary = stripHeading(summaryData.conceptSummary, /^이것만 꼭 알아둬!?\s*/i);
    }
    if (summaryData.detailedContent && typeof summaryData.detailedContent === 'string') {
      summaryData.detailedContent = stripHeading(summaryData.detailedContent, /^📖?\s*오늘\s*수업\s*핵심\s*정리\s*/i);
    }

    // 핵심 정리 통합 (conceptSummary + detailedContent)
    const combinedCore = [summaryData.conceptSummary, summaryData.detailedContent]
      .filter((v: any) => typeof v === 'string' && v.trim().length > 0)
      .join('\n\n');
    if (combinedCore) {
      summaryData.detailedContent = combinedCore;
      summaryData.conceptSummary = '';
    }

    // todayMission은 POC에서 숨김
    summaryData.todayMission = '';

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
      imagesUsed: imagesToUse,
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
