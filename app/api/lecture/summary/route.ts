import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Collections } from '@/lib/db';
import { loadCorrectAndParseStt, parseSttData, preprocessSttText, type Conversation } from '@/lib/stt-utils';
import { getSubjectGuide } from '@/lib/prompts/subjectPrompts';
import { buildSummaryPrompt } from '@/lib/prompts/summaryPrompt';
import { buildCurriculumHint, buildCurriculumReference } from '@/lib/curriculum/matchCurriculum';
import { splitConversationsIntoSections, getSectionSttText, type Section } from '@/lib/section-splitter';
import { getGradeByUserNo } from '@/lib/student-grade-matcher';
import { getKSTYear, getCurrentKSTYear, formatKSTDate } from '@/lib/time-utils';
import { generateWithLimiter } from '@/lib/gemini-rate-limiter';

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

function countKeywordHits(text: string, keywords: string[]): number {
  return keywords.reduce((score, keyword) => (text.includes(keyword) ? score + 1 : score), 0);
}

function detectSessionFocus(sttText?: string | null): 'lesson' | 'counseling' {
  if (!sttText) return 'lesson';
  const text = sttText.toLowerCase();

  const counselingKeywords = [
    '상담', '고민', '불안', '멘탈', '마음', '스트레스', '긴장', '자신감', '동기',
    '집중', '집중력', '습관', '계획', '시간관리', '공부법', '공부 습관', '루틴',
    '목표', '진로', '슬럼프', '피드백', '칭찬', '격려', '상태', '페이스', '컨디션',
  ];
  const lessonKeywords = [
    '개념', '공식', '정리', '문제', '풀이', '정답', '예제', '단원', '문법',
    '함수', '방정식', '비교급', '최상급', '주어', '동사', '그래프', '도형',
  ];

  const counselingScore = countKeywordHits(text, counselingKeywords);
  const lessonScore = countKeywordHits(text, lessonKeywords);

  if (counselingScore >= 3 && (lessonScore === 0 || counselingScore >= lessonScore * 2)) {
    return 'counseling';
  }

  return 'lesson';
}

function hasLessonSignals(sttText?: string | null): boolean {
  if (!sttText) return false;
  const text = sttText.toLowerCase();
  const lessonKeywords = [
    '개념', '공식', '정리', '문제', '풀이', '정답', '예제', '단원', '문법',
    '함수', '방정식', '비교급', '최상급', '주어', '동사', '그래프', '도형',
  ];
  return countKeywordHits(text, lessonKeywords) >= 2;
}

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
  imageTimeline?: Array<{ start: number; end: number; src: string }>;
  cachedPrompt?: string | null;
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

async function fetchImageTimeline(roomId: string): Promise<{
  images: string[];
  timeline: Array<{ start: number; end: number; src: string }>;
}> {
  try {
    const res = await fetch(
      `${LECTURE_API_BASE_URL}/image/${roomId}`,
      { headers: { accept: 'application/json' } }
    );
    if (!res.ok) {
      return { images: [], timeline: [] };
    }
    const data = await res.json();
    if (!data?.presigned_url) {
      return { images: [], timeline: [] };
    }

    const timelineRes = await fetch(data.presigned_url);
    if (!timelineRes.ok) {
      return { images: [], timeline: [] };
    }
    const timelineData = await timelineRes.json();
    if (!Array.isArray(timelineData)) {
      return { images: [], timeline: [] };
    }

    const timeline = timelineData
      .filter((item: any) => item && item.src && Number.isFinite(item.start) && Number.isFinite(item.end))
      .map((item: any) => ({
        start: Number(item.start),
        end: Number(item.end),
        src: String(item.src),
      }))
      .sort((a, b) => a.start - b.start);

    const images: string[] = [];
    const seen = new Set<string>();
    for (const item of timeline) {
      if (!seen.has(item.src)) {
        images.push(item.src);
        seen.add(item.src);
      }
    }

    return { images, timeline };
  } catch {
    return { images: [], timeline: [] };
  }
}

async function fetchTextTimeline(roomId: string): Promise<Conversation[]> {
  try {
    const res = await fetch(
      `${LECTURE_API_BASE_URL}/text/${roomId}`,
      { headers: { accept: 'application/json' } }
    );
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    const presignedUrl = data?.presigned_url;

    if (presignedUrl) {
      const textRes = await fetch(presignedUrl);
      if (!textRes.ok) {
        return [];
      }
      const rawText = preprocessSttText(await textRes.text());
      const jsonData = JSON.parse(rawText);
      if (Array.isArray(jsonData)) {
        return jsonData
          .map((conv: any) => {
            let speaker = 'unknown';
            let text = '';
            if (conv.user === 'teacher' || conv.user === 'T' || conv.speaker === 'teacher') {
              speaker = 'teacher';
              text = conv.teacher_text || conv.text || conv.content || conv.transcript || '';
            } else if (conv.user === 'student' || conv.user === 'S' || conv.speaker === 'student') {
              speaker = 'student';
              text = conv.student_text || conv.text || conv.content || conv.transcript || '';
            } else {
              speaker = conv.speaker || conv.role || 'unknown';
              text = conv.text || conv.content || conv.transcript || '';
            }

            const timestamp =
              typeof conv.start === 'number'
                ? conv.start
                : typeof conv.start_time === 'number'
                ? conv.start_time
                : typeof conv.startTime === 'number'
                ? conv.startTime
                : conv.timestamp || conv.time || null;

            return { speaker, text, timestamp };
          })
          .filter((conv: Conversation) => conv.text && conv.text.trim().length > 0);
      }
      return parseSttData(jsonData);
    }

    if (Array.isArray(data) || (data && typeof data === 'object')) {
      return parseSttData(data);
    }

    return [];
  } catch {
    return [];
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
    const { roomId, grade, testMode, forcePromptRefresh, useSectionMode } = body;

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
    let autoGrade: string | null = null;
    let sttText: string | null = null;
    let missedParts: Array<{ question: string; studentResponse?: string; correctAnswer?: string; explanation?: string }> = [];
    let fullConversation: Conversation[] = [];
    let reportTextTimeline: Conversation[] = [];
    let images: string[] = [];
    let imageTimeline: Array<{ start: number; end: number; src: string }> = [];
    let sttImageRefs: string[] = [];
    let imagesToUse: string[] = [];
    let usedCache = false;
    let cachedPrompt: string | null = null;

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
        imageTimeline = cached.imageTimeline || [];
        sttImageRefs = cached.sttImageRefs || [];
        imagesToUse = cached.imagesToUse || [];
        cachedPrompt = cached.cachedPrompt || null;

        if (isDevelopment) {
          console.log(`[lecture/summary] 🧪 테스트 모드 캐시 사용: ${roomId}`);
        }
      }
    }

    if (!usedCache) {
      const [roomMetaRes, sttPromise, imagesPromise, studentInfoPromise, textTimelinePromise] =
        await Promise.allSettled([
          // 1. Room 메타데이터
          fetch(`${LECTURE_API_BASE_URL}/meta/room/${roomId}`, {
            headers: { 'Content-Type': 'application/json' },
          }),
          // 2. STT 텍스트 가져오기 및 보정 (공통 유틸리티 사용)
          loadCorrectAndParseStt(roomId, LECTURE_API_BASE_URL, apiKey),
          // 3. 교재 이미지 가져오기 (image API 우선)
          (async () => {
            try {
              const timelineResult = await fetchImageTimeline(roomId);
              if (timelineResult.images.length > 0) {
                return timelineResult;
              }

              const baseUrl = req.nextUrl.origin;
              const imagesRes = await fetch(`${baseUrl}/api/admin/room-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId }),
              });
              if (imagesRes.ok) {
                const imagesData = await imagesRes.json();
                const urls = imagesData.urls && Array.isArray(imagesData.urls) ? imagesData.urls : [];
                return { images: urls, timeline: [] };
              }
              return { images: [], timeline: [] };
            } catch {
              return { images: [], timeline: [] };
            }
          })(),
          // 4. 학생 정보 (Pagecall API) + 수업 년도 확인
          (async () => {
            try {
              const pagecallToken = process.env.PAGECALL_API_TOKEN;
              if (!pagecallToken) {
                console.warn('[lecture/summary] ⚠️ PAGECALL_API_TOKEN이 설정되지 않았습니다.');
                return { studentId: null, studentName: null, studentNickname: null, sessionYear: null };
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
                return { studentId: null, studentName: null, studentNickname: null, sessionYear: null };
              }

              const sessionsData = await sessionsRes.json();

              // 수업 년도 추출 (connected_at 또는 disconnected_at 기준, KST 기준)
              let sessionYear: number | null = null;
              if (sessionsData.sessions && Array.isArray(sessionsData.sessions) && sessionsData.sessions.length > 0) {
                // 첫 번째 세션의 connected_at 또는 disconnected_at 사용
                const firstSession = sessionsData.sessions[0];
                const dateStr = firstSession.connected_at || firstSession.disconnected_at;
                if (dateStr) {
                  // KST 기준으로 년도 추출
                  sessionYear = getKSTYear(dateStr);
                  if (isDevelopment) {
                    console.log(`[lecture/summary] 📅 수업 년도 추출 (KST 기준): ${sessionYear}년 (${dateStr} → ${formatKSTDate(dateStr)})`);
                  }
                }
              }

              if (isDevelopment) {
                console.log(`[lecture/summary] 📊 Pagecall API 응답:`, {
                  ok: sessionsData.ok,
                  sessionsCount: sessionsData.sessions?.length || 0,
                  sessionYear,
                });
              }

              if (sessionsData.sessions && Array.isArray(sessionsData.sessions)) {
                // 먼저 학생(S_) 세션 찾기, 없으면 선생님(T_) 세션 확인
                let studentSession: any = null;
                let teacherSession: any = null;

                for (const session of sessionsData.sessions) {
                  if (session.user_id && typeof session.user_id === 'string') {
                    if (isDevelopment) {
                      console.log(`[lecture/summary] 🔍 세션 user_id 확인:`, session.user_id);
                    }

                    // 학생 세션 찾기: "이름(S_숫자)" 형식
                    const studentMatch = session.user_id.match(/^(.+?)\(S_(\d+)\)$/);
                    if (studentMatch && !studentSession) {
                      studentSession = {
                        name: studentMatch[1].trim(),
                        id: studentMatch[2],
                        session,
                      };
                    } else if (!studentMatch) {
                      // "S_숫자"만 있는 경우도 확인
                      const simpleStudentMatch = session.user_id.match(/S_(\d+)/);
                      if (simpleStudentMatch && !studentSession) {
                        studentSession = {
                          name: null,
                          id: simpleStudentMatch[1],
                          session,
                        };
                      }
                    }

                    // 선생님 세션도 기록 (학생이 없을 때 참고용)
                    if (session.user_id.includes('(T_') && !teacherSession) {
                      const teacherMatch = session.user_id.match(/^(.+?)\(T_(\d+)\)$/);
                      if (teacherMatch) {
                        teacherSession = {
                          name: teacherMatch[1].trim(),
                          id: teacherMatch[2],
                          session,
                        };
                      }
                    }
                  }
                }

                // 학생 세션 발견
                if (studentSession) {
                  const studentNickname = studentSession.name && studentSession.name.length >= 2
                    ? studentSession.name.slice(-2)
                    : studentSession.name;

                  console.log(`[lecture/summary] ✅ 학생 정보 발견: ${studentSession.name || '(이름 없음)'} (ID: ${studentSession.id}, 닉네임: ${studentNickname})`);
                  return {
                    studentId: studentSession.id,
                    studentName: studentSession.name,
                    studentNickname: studentNickname || null,
                    sessionYear,
                  };
                }

                // 학생이 없고 선생님만 있는 경우 로그
                if (teacherSession && isDevelopment) {
                  console.log(`[lecture/summary] ℹ️ 학생 세션이 없고 선생님만 있음: ${teacherSession.name}(T_${teacherSession.id})`);
                }

                if (isDevelopment) {
                  console.warn(`[lecture/summary] ⚠️ 학생 정보를 찾을 수 없습니다. 세션 수: ${sessionsData.sessions.length}`);
                  console.log(`[lecture/summary] 세션 user_id 목록:`, sessionsData.sessions.map((s: any) => s.user_id));
                }
              }

              return { studentId: null, studentName: null, studentNickname: null, sessionYear };
            } catch (err: any) {
              console.error('[lecture/summary] ❌ Pagecall API 호출 중 오류:', err?.message || err);
              return { studentId: null, studentName: null, studentNickname: null, sessionYear: null };
            }
          })(),
          // 5. report-backend text (image 매칭용 fallback)
          fetchTextTimeline(roomId),
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
      let sessionYear: number | null = null;
      if (studentInfoPromise.status === 'fulfilled') {
        const studentInfo = studentInfoPromise.value;
        studentId = studentInfo.studentId;
        studentName = studentInfo.studentName;
        studentNickname = studentInfo.studentNickname;
        sessionYear = studentInfo.sessionYear || null;

        // 유저 번호로 학년 자동 조회 (수업 년도 고려)
        if (studentId) {
          autoGrade = await getGradeByUserNo(studentId, sessionYear);
          if (autoGrade && isDevelopment) {
            console.log(`[lecture/summary] ✅ 학년 자동 매칭: ${studentId} → ${autoGrade}${sessionYear ? ` (수업 년도: ${sessionYear}년)` : ''}`);
          }
        }

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
      } else if (isDevelopment) {
        console.error('[lecture/summary] STT 텍스트 로드 실패:', sttPromise.reason);
      }

      if (textTimelinePromise.status === 'fulfilled') {
        reportTextTimeline = textTimelinePromise.value || [];
      } else {
        reportTextTimeline = [];
      }

      // 이미지 처리 (병렬로 이미 로드됨)
      if (imagesPromise.status === 'fulfilled') {
        images = Array.isArray(imagesPromise.value?.images) ? imagesPromise.value.images : [];
        imageTimeline = Array.isArray(imagesPromise.value?.timeline) ? imagesPromise.value.timeline : [];
      } else {
        images = [];
        imageTimeline = [];
      }
      sttImageRefs = [];

      if (imageTimeline.length > 0 && fullConversation.length > 0) {
        const parseDurationSeconds = (value: string): number | null => {
          let text = value.trim();
          if (!text) return null;
          if (text.includes('~')) {
            text = text.split('~')[0]?.trim() || '';
          }

          const colonMatch = text.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
          if (colonMatch) {
            const hours = colonMatch[1] ? Number(colonMatch[1]) : 0;
            const minutes = Number(colonMatch[2]);
            const seconds = Number(colonMatch[3]);
            if ([hours, minutes, seconds].every((n) => Number.isFinite(n))) {
              return hours * 3600 + minutes * 60 + seconds;
            }
          }

          const hmsMatch = text.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m)?\s*(\d+(?:\.\d+)?)\s*s?$/i);
          if (hmsMatch) {
            const hours = hmsMatch[1] ? Number(hmsMatch[1]) : 0;
            const minutes = hmsMatch[2] ? Number(hmsMatch[2]) : 0;
            const seconds = Number(hmsMatch[3]);
            if ([hours, minutes, seconds].every((n) => Number.isFinite(n))) {
              return hours * 3600 + minutes * 60 + seconds;
            }
          }

          return null;
        };

        const normalizeSeconds = (value: unknown): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'string') {
            const asNumber = Number(value);
            if (Number.isFinite(asNumber)) {
              return asNumber > 100000 ? asNumber / 1000 : asNumber;
            }
            const durationSeconds = parseDurationSeconds(value);
            if (typeof durationSeconds === 'number') return durationSeconds;
            const parsed = Date.parse(value);
            if (!Number.isNaN(parsed)) return parsed / 1000;
            return null;
          }
          if (typeof value === 'number') {
            if (!Number.isFinite(value)) return null;
            return value > 100000 ? value / 1000 : value;
          }
          return null;
        };

        const timelineSeconds = imageTimeline
          .map((item) => ({
            start: normalizeSeconds(item.start),
            end: normalizeSeconds(item.end),
            src: item.src,
          }))
          .filter((item): item is { start: number; end: number; src: string } =>
            typeof item.start === 'number' &&
            typeof item.end === 'number' &&
            item.start <= item.end
          )
          .sort((a, b) => a.start - b.start);

        const sttTimes = fullConversation
          .map((conv) => normalizeSeconds(conv.timestamp))
          .filter((time): time is number => typeof time === 'number');

        const timelineMin = timelineSeconds.length > 0 ? timelineSeconds[0].start : null;
        const timelineMax = timelineSeconds.length > 0 ? timelineSeconds[timelineSeconds.length - 1].end : null;
        const sttMin = sttTimes.length > 0 ? Math.min(...sttTimes) : null;
        const sttMax = sttTimes.length > 0 ? Math.max(...sttTimes) : null;

        const hasDirectOverlap =
          typeof timelineMin === 'number' &&
          typeof timelineMax === 'number' &&
          typeof sttMin === 'number' &&
          typeof sttMax === 'number' &&
          sttMin <= timelineMax &&
          sttMax >= timelineMin;

        const offset =
          typeof timelineMin === 'number' && typeof sttMin === 'number' ? timelineMin - sttMin : null;

        const normalizeText = (value?: string | null): string => (value || '').replace(/\s+/g, '').toLowerCase();
        const reportByText = new Map<string, Conversation[]>();
        for (const item of reportTextTimeline) {
          const key = normalizeText(item.text);
          if (!key) continue;
          const list = reportByText.get(key) || [];
          list.push(item);
          reportByText.set(key, list);
        }

        const reportAlignedByIndex =
          reportTextTimeline.length === fullConversation.length ? reportTextTimeline : null;
        const reportAlignedByText = reportTextTimeline.length > 0
          ? fullConversation.map((conv) => {
              const key = normalizeText(conv.text);
              const list = reportByText.get(key);
              if (list && list.length > 0) {
                return list.shift() || null;
              }
              return null;
            })
          : [];

        const findImageForTime = (time?: number | string | null): string | null => {
          const normalized = normalizeSeconds(time);
          if (typeof normalized !== 'number') return null;
          const directMatch = timelineSeconds.find((img) => normalized >= img.start && normalized <= img.end);
          if (directMatch) return directMatch.src;
          if (!hasDirectOverlap && typeof offset === 'number') {
            const aligned = normalized + offset;
            const alignedMatch = timelineSeconds.find((img) => aligned >= img.start && aligned <= img.end);
            return alignedMatch ? alignedMatch.src : null;
          }
          return null;
        };

        if (timelineSeconds.length > 0) {
          fullConversation = fullConversation.map((conv, index) => {
            const reportFallback =
              reportAlignedByIndex?.[index]?.timestamp ??
              reportAlignedByText?.[index]?.timestamp ??
              null;
            const mapped = findImageForTime(reportFallback ?? conv.timestamp);
            if (!mapped) return conv;
            return { ...conv, imageRef: mapped };
          });
        }
      }

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
      console.log(`[lecture/summary] 수업 날짜 (KST): ${tutoringDatetime ? formatKSTDate(tutoringDatetime) : '없음'}`);
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
      model: 'gemini-2.5-pro',
      safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.5,
        responseMimeType: 'application/json', // JSON 형식 강제
      },
    });

    // 프롬프트 생성
    const displayName = studentNickname || studentName || null;
    // 학년 우선순위: body로 전달된 grade > 자동 매칭된 학년
    const gradeLabel = 
      (typeof grade === 'string' && grade.trim().length > 0) 
        ? grade.trim() 
        : autoGrade || null;
    const subjectGuide = getSubjectGuide(subject);
    const sessionFocus = detectSessionFocus(sttText);
    const allowCurriculumHint = sessionFocus !== 'counseling' || hasLessonSignals(sttText);
    const curriculumHint = buildCurriculumHint({
      sttText,
      subject,
      gradeLabel,
    });
    const curriculumReference = buildCurriculumReference({
      sttText,
      subject,
      gradeLabel,
    });
    const curriculumHintToUse = allowCurriculumHint ? curriculumHint : null;
    const curriculumReferenceToUse = allowCurriculumHint ? curriculumReference : null;
    const imagesForPrompt = images;

    if (isDevelopment && curriculumHintToUse) {
      console.log('[lecture/summary] 📚 커리큘럼 매칭 힌트 적용');
    }
    if (isDevelopment && sessionFocus === 'counseling') {
      console.log('[lecture/summary] 🧠 상담 중심 수업 감지: 이미지/커리큘럼은 STT 관련성 기준으로만 사용');
    }

    // 캐시가 있어도 프롬프트는 항상 새로 생성 (프롬프트 수정 반영을 위해)
    const prompt = buildSummaryPrompt({
      displayName,
      studentName,
      studentId,
      gradeLabel,
      subject,
      subjectGuide,
      curriculumHint: curriculumHintToUse,
      tutoringDatetime,
      sttText,
      missedParts,
      images: imagesForPrompt,
      sessionFocus,
    });

    // 🎯 STT 기반 이미지 관련성 분석 및 선택 (최적화: 이미지 캐싱)
    const imageCache = new Map<string, { buffer: Buffer; mimeType: string }>(); // 이미지 다운로드 캐시

    if (sessionFocus === 'counseling') {
      if (sttImageRefs.length > 0 && images.length > 0) {
        const counselingImages = sttImageRefs
          .map((ref: string) => images.find((url: string) => url.includes(ref) || ref.includes(url.split('/').pop() || '')))
          .filter((url): url is string => !!url);
        imagesToUse = counselingImages;
      } else if (images.length > 0 && sttText) {
        const counselingPrompt = `이 이미지는 수업 중에 제공된 자료입니다.

**수업 대화 내용 (STT):**
${sttText.substring(0, 800)}

이 이미지가 학습 상담(학습 계획/루틴/목표/상태/멘탈/공부법)과 직접 관련이 있는지 판단해주세요.

**판단 기준:**
1. 학습 계획표, 시간표, 체크리스트, 목표 설정표, 루틴 메모인지
2. 학습 상태/습관/멘탈 관련 도표나 자료인지
3. 교재/문제집 단원 내용일 경우 -> 관련 없음

**응답 형식 (JSON만):**
{
  "relevant": true/false,
  "score": 0-100,
  "reason": "관련성 이유 (간단히)"
}`;

        try {
          const analysisModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-pro',
            safetySettings: GEMINI_SAFETY_SETTINGS,
          });

          const imageDownloadPromises = images.map(async (imageUrl) => {
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

          const analysisPromises = downloadedImages.map(async ({ url, imageData }) => {
            try {
              const analysisResult = await generateWithLimiter(analysisModel, {
                contents: [{
                  role: 'user',
                  parts: [
                    {
                      inlineData: {
                        data: imageData.buffer.toString('base64'),
                        mimeType: imageData.mimeType,
                      },
                    },
                    { text: counselingPrompt },
                  ],
                }],
              });

              const analysisText = analysisResult.response.text();
              const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                if (analysis.relevant && analysis.score >= 50) {
                  return { url, score: analysis.score || 50 };
                }
              }
              return null;
            } catch {
              return null;
            }
          });

          const imageScores = (await Promise.all(analysisPromises))
            .filter((item): item is { url: string; score: number } => item !== null)
            .sort((a, b) => b.score - a.score);

          imagesToUse = imageScores.map((img) => img.url);
        } catch {
          imagesToUse = [];
        }
      } else {
        imagesToUse = [];
      }
    } else if (imagesToUse.length === 0) {
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
              const analysisResult = await generateWithLimiter(analysisModel, {
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

    if (isTestMode && (!usedCache || forcePromptRefresh)) {
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
        imageTimeline,
        cachedPrompt: prompt,
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
    
    // 섹션별 생성 모드 (테스트용)
    let shouldUseSectionMode = Boolean(useSectionMode) && fullConversation.length > 0;
    
    let summaryData: any = null;
    
    if (shouldUseSectionMode) {
      if (isDevelopment) {
        console.log(`[lecture/summary] 📑 섹션별 생성 모드 시작`);
      }

      // 섹션 분할
      const sections = splitConversationsIntoSections(fullConversation, images);
      
      if (isDevelopment) {
        console.log(`[lecture/summary] 📑 총 ${sections.length}개 섹션 분할 완료`);
      }

      // 각 섹션별 요약 생성
      const sectionSummaries: Array<{ sectionIndex: number; summary: any; images: string[] }> = [];
      
      for (const section of sections) {
        const sectionSttText = getSectionSttText(section);
        const sectionImages = section.imageRefs.length > 0 
          ? section.imageRefs 
          : images.slice(0, 3); // 기본값: 처음 3개 이미지

        // 섹션별 프롬프트 생성 (간단한 버전)
        const sectionPrompt = buildSummaryPrompt({
          displayName,
          studentName,
          studentId,
          gradeLabel,
          subject,
          subjectGuide,
          curriculumHint: curriculumHintToUse,
          tutoringDatetime,
          sttText: sectionSttText,
          missedParts: [], // 섹션별로는 놓친 부분 생략
          images: sectionImages,
          sessionFocus,
        });

        // 섹션별 이미지 다운로드
        const sectionParts: any[] = [{ text: sectionPrompt }];
        if (sectionImages.length > 0) {
          const sectionImagePromises = sectionImages.map(async (imageUrl) => {
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
          
          const sectionImageParts = (await Promise.all(sectionImagePromises))
            .filter((part): part is { inlineData: { data: string; mimeType: string } } => part !== null);
          
          sectionParts.push(...sectionImageParts);
        }

        // 섹션별 요약 생성
        if (isDevelopment) {
          console.log(`[lecture/summary] 📑 섹션 ${section.index + 1}/${sections.length} 생성 중... (STT: ${sectionSttText.length}자, 이미지: ${sectionImages.length}개)`);
        }

        try {
          const sectionResult = await generateWithLimiter(model, {
            contents: [{ role: 'user', parts: sectionParts }],
          });

          const sectionResponseText = sectionResult.response.text();
          let sectionSummary: any = null;

          // JSON 파싱 (간단 버전)
          try {
            const cleaned = sectionResponseText
              .replace(/^```json\s*/gim, '')
              .replace(/^```\s*/gim, '')
              .replace(/\s*```$/gim, '')
              .replace(/```/g, '')
              .trim();
            
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              sectionSummary = JSON.parse(jsonMatch[0]);
            }
          } catch (parseErr) {
            if (isDevelopment) {
              console.warn(`[lecture/summary] ⚠️ 섹션 ${section.index + 1} JSON 파싱 실패, 스킵`);
            }
          }

          if (sectionSummary) {
            sectionSummaries.push({
              sectionIndex: section.index,
              summary: sectionSummary,
              images: sectionImages,
            });
            
            if (isDevelopment) {
              console.log(`[lecture/summary] ✅ 섹션 ${section.index + 1}/${sections.length} 완료`);
            }
          }
        } catch (sectionErr: any) {
          if (isDevelopment) {
            console.error(`[lecture/summary] ❌ 섹션 ${section.index + 1} 생성 실패:`, sectionErr?.message || sectionErr);
          }
        }
      }

      // 섹션 요약들을 통합
      if (sectionSummaries.length > 0) {
        if (isDevelopment) {
          console.log(`[lecture/summary] 📑 섹션 요약 통합 중... (${sectionSummaries.length}개 섹션)`);
        }

        // 통합 프롬프트 생성
        const integrationPrompt = `당신은 수업 요약 통합 전문가입니다.

**생성된 섹션별 요약:**

${sectionSummaries.map((s, idx) => `
## 섹션 ${idx + 1}:
- 제목: ${s.summary.title || '없음'}
- 핵심 내용: ${s.summary.detailedContent?.substring(0, 500) || s.summary.conceptSummary?.substring(0, 500) || '없음'}
`).join('\n')}

**작업:**
위 섹션별 요약들을 읽고, 전체 수업을 일관성 있게 통합한 하나의 요약본을 생성해주세요.

**출력 형식 (기존 요약본 형식과 동일):**
- title: 전체 수업 제목
- detailedContent: 모든 섹션을 통합한 상세 내용
- conceptSummary: 핵심 개념 요약
- cardNewsContent: 카드뉴스 내용 (5-8개 카드)
- cardQuizHints: 카드 확인 문제 (각 카드당 1개)
- visualAids: 시각 자료 (필요시)
- 기타 필수 필드 모두 포함

**중요:**
- 모든 섹션의 내용을 포함해야 함
- 일관성 있는 톤과 스타일 유지
- 중복 제거하되 중요한 내용은 놓치지 말 것
- 원본 섹션 요약의 구조를 최대한 유지`;

        // 통합 요약 생성
        const integrationResult = await generateWithLimiter(model, {
          contents: [{ role: 'user', parts: [{ text: integrationPrompt }] }],
        });

        const integrationResponseText = integrationResult.response.text();
        
        try {
          const cleaned = integrationResponseText
            .replace(/^```json\s*/gim, '')
            .replace(/^```\s*/gim, '')
            .replace(/\s*```$/gim, '')
            .replace(/```/g, '')
            .trim();
          
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            summaryData = JSON.parse(jsonMatch[0]);
            
            if (isDevelopment) {
              console.log(`[lecture/summary] ✅ 섹션 요약 통합 완료`);
            }
          }
        } catch (parseErr) {
          if (isDevelopment) {
            console.error(`[lecture/summary] ❌ 통합 요약 파싱 실패, 첫 번째 섹션 사용`);
          }
          // 파싱 실패 시 첫 번째 섹션 요약 사용
          summaryData = sectionSummaries[0]?.summary || null;
        }
      } else {
        if (isDevelopment) {
          console.error(`[lecture/summary] ❌ 모든 섹션 생성 실패, 기본 모드로 폴백`);
        }
        // 섹션별 생성 실패 시 기본 모드로 폴백
        shouldUseSectionMode = false;
      }
    }

    // 기본 모드 (섹션별 모드가 아니거나 실패한 경우)
    if (!summaryData) {
      if (isDevelopment) {
        console.log(`[lecture/summary] 📤 Gemini API 호출 시작 (프롬프트 길이: ${prompt.length}자, 이미지: ${imagesToUse.length}개)`);
      }

      const result = await generateWithLimiter(model, {
        contents: [{ role: 'user', parts }],
      });

      const responseText = result.response.text();
      
      if (isDevelopment) {
        console.log(`[lecture/summary] ✅ Gemini 응답 수신 (길이: ${responseText.length}자)`);
        console.log(`[lecture/summary] 📝 응답 미리보기:\n${responseText.substring(0, 300)}...`);
      }
      
      // JSON 파싱 (강화된 로직)
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
    }
    
    // 문자열 필드가 JSON 문자열인 경우 파싱 (Gemini가 중첩 JSON을 반환하는 경우 대비)
    const stringFields = [
      'conceptSummary',
      'textbookHighlight',
      'teacherMessage',
      'todayMission',
      'encouragement',
      'detailedContent',
      'cardNewsContent',
    ];
    for (const field of stringFields) {
      if (summaryData[field] && typeof summaryData[field] === 'string') {
        const value = summaryData[field].trim();
        // JSON 문자열인지 확인 (시작이 { 또는 [로 시작하고 끝이 } 또는 ]로 끝나는 경우)
        if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
          try {
            const parsed = JSON.parse(value);
            // 파싱된 값이 문자열이면 교체, 객체면 요약 구조로 추정 시 merge
            if (typeof parsed === 'string') {
              summaryData[field] = parsed;
            } else if (parsed && typeof parsed === 'object') {
              const hasSummaryShape = ['title', 'teacherMessage', 'unitTitle', 'detailedContent', 'textbookHighlight'].some(
                (key) => key in parsed
              );
              if (hasSummaryShape) {
                summaryData = { ...summaryData, ...parsed };
              }
            }
          } catch {
            // JSON 파싱 실패 시 원본 문자열 유지
          }
        }
      }
    }

    // cardNewsContent가 문자열 JSON 배열로 온 경우 처리
    if (summaryData.cardNewsContent && typeof summaryData.cardNewsContent === 'string') {
      const value = summaryData.cardNewsContent.trim();
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            summaryData.cardNewsContent = parsed;
          }
        } catch {
          // ignore
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
      cardNewsContent: summaryData.cardNewsContent || [],
      visualAids: summaryData.visualAids || [],
      missedParts: summaryData.missedParts || [],
      todayMission: summaryData.todayMission || '',
      cardQuizHints: summaryData.cardQuizHints || [],
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
        imageTimeline: imageTimeline || [],
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
        imageTimelineCount: imageTimeline.length,
        hasStt: !!sttText,
        missedPartsCount: missedParts.length,
        isSecretNote: true,
        curriculumReference: curriculumReferenceToUse || null,
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
      
      const reviewProgramUrl = `${req.nextUrl.origin}/admin/lecture-summary?reviewProgramId=${insertResult.insertedId.toString()}`;
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
        cardQuizHints: [],
        encouragement: '',
      };
    }

    const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
    const extractTokens = (value: string) => value.match(/[A-Za-z가-힣]{2,}/g) || [];
    const getRequiredQuizCount = (cards: any[]) => {
      const count = cards.length;
      if (count <= 0) return 0;
      if (count < 3) return count;
      return Math.min(6, count);
    };
    const isValidHint = (hint: any) => {
      if (!hint || typeof hint !== 'object') return false;
      const question = String(hint.question || '').trim();
      const options = Array.isArray(hint.options) ? hint.options.map((o: any) => String(o).trim()) : [];
      const answerIndex = hint.answerIndex;
      if (!question || question.length < 8 || !question.includes('___')) return false;
      if (options.length !== 2) return false;
      if (!options[0] || !options[1] || options[0] === options[1]) return false;
      if (answerIndex !== 0 && answerIndex !== 1) return false;
      if (options.some((opt: string) => opt.length < 2)) return false;
      return true;
    };

    const hasCardContentMatch = (hint: any, cardText: string) => {
      const question = String(hint.question || '');
      const options = Array.isArray(hint.options) ? hint.options.map((o: any) => String(o)) : [];
      const normalizedCard = normalizeText(cardText);
      const optionsInCard = options.every((opt: string) => {
        const normalizedOpt = normalizeText(opt);
        return normalizedOpt.length >= 2 && normalizedCard.includes(normalizedOpt);
      });
      if (!optionsInCard) return false;
      const questionTokens = extractTokens(question.replace('___', ''));
      return questionTokens.some((token) => normalizedCard.includes(normalizeText(token)));
    };

    if (!Array.isArray(summaryData.cardQuizHints)) {
      summaryData.cardQuizHints = [];
    }
    if (Array.isArray(summaryData.cardNewsContent) && summaryData.cardNewsContent.length > 0) {
      summaryData.cardQuizHints = summaryData.cardQuizHints.filter((hint: any, idx: number) => {
        if (!isValidHint(hint)) return false;
        const card = summaryData.cardNewsContent[idx];
        const cardText = `${card?.title || ''} ${card?.body || ''}`.trim();
        if (!cardText) return false;
        return hasCardContentMatch(hint, cardText);
      });
    } else {
      summaryData.cardQuizHints = summaryData.cardQuizHints.filter((hint: any) => isValidHint(hint));
    }

    const cardNewsContent = Array.isArray(summaryData.cardNewsContent) ? summaryData.cardNewsContent : [];
    const requiredQuizCount = getRequiredQuizCount(cardNewsContent);
    if (requiredQuizCount > 0 && summaryData.cardQuizHints.length < requiredQuizCount) {
      summaryData.cardQuizHints = [];
    }
    if (sessionFocus === 'counseling') {
      summaryData.cardQuizHints = [];
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
      curriculumReference: curriculumReferenceToUse || null,
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
