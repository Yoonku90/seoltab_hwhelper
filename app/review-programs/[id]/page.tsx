'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import MarkdownMath from '@/app/components/MarkdownMath';

// 요약본 이미지 컴포넌트
function SummaryImages({ roomId, imageUrls }: { roomId?: string; imageUrls?: string[] }) {
  const [images, setImages] = useState<string[]>(imageUrls || []);
  const [loading, setLoading] = useState(!imageUrls && !!roomId);

  useEffect(() => {
    if (!roomId || imageUrls?.length) return;

    const fetchImages = async () => {
      try {
        const res = await fetch('/api/admin/room-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.urls && Array.isArray(data.urls)) {
            setImages(data.urls);
          }
        }
      } catch (err) {
        console.error('이미지 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [roomId, imageUrls]);

  if (loading) {
    return <p className={styles.imageHint}>이미지 불러오는 중...</p>;
  }

  if (images.length === 0) {
    return <p className={styles.imageHint}>교재 이미지가 없습니다.</p>;
  }

  return (
    <div className={styles.imageGrid}>
      {images.map((url: string, idx: number) => (
        <div
          key={idx}
          className={styles.summaryImageItem}
          onClick={() => {
            // 이미지 확대 모달
            const modal = document.createElement('div');
            modal.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.9);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 10000;
              cursor: pointer;
            `;
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = `
              max-width: 90vw;
              max-height: 90vh;
              object-fit: contain;
              cursor: zoom-out;
            `;
            modal.appendChild(img);
            modal.onclick = () => document.body.removeChild(modal);
            document.body.appendChild(modal);
          }}
        >
          <img src={url} alt={`교재 이미지 ${idx + 1}`} />
        </div>
      ))}
    </div>
  );
}
// 🤖 AI Agent: 이벤트 수집
import {
  trackSessionStart,
  trackSessionEnd,
  trackConceptLearned,
  trackQuizCorrect,
  trackQuizIncorrect,
} from './event-tracker';

type TutorState = {
  stage: 'intro' | 'keyPoints' | 'practice' | 'quiz' | 'wrapup';
  idx: number;
  awaiting?: 'none' | 'free_answer';
  expectedAnswer?: string;
  lastAsked?: string;
};

type ChatMsg = {
  from: 'rang' | 'student';
  text: string;
  highlightRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
    problemNumber?: number;
  } | null;
};

export default function ReviewProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  
  // 🤖 AI 에이전트: URL 파라미터에서 studentId 읽기
  const urlStudentId = searchParams.get('studentId');

  const [loading, setLoading] = useState(true);
  const [rp, setRp] = useState<any | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [tutorState, setTutorState] = useState<TutorState>({
    stage: 'intro',
    idx: 0,
    awaiting: 'none',
  });
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const didInitTutorRef = useRef(false);
  
  // 🤖 AI 에이전트: 학생 프로필
  const [studentName, setStudentName] = useState<string>('');
  const [studentId, setStudentId] = useState<string>(urlStudentId || 'guest');
  
  // 🤖 AI Agent: 세션 추적
  const sessionStartTimeRef = useRef<number>(Date.now());
  const lastTutorMessageRef = useRef<string>('');
  const sessionStartedRef = useRef(false);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 🖼️ Phase 2: setTimeout cleanup용

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/review-programs/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '불러오기 실패');
        setRp(data.reviewProgram);
        // studentId 저장
        if (data.reviewProgram?.studentId) {
          setStudentId(data.reviewProgram.studentId);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 🤖 AI 에이전트: 학생 프로필 불러오기
  useEffect(() => {
    const loadStudentProfile = async () => {
      try {
        const res = await fetch(`/api/students?studentId=${studentId}`);
        const data = await res.json();
        if (data.exists && data.student) {
          setStudentName(data.student.name);
        }
      } catch (error) {
        console.error('학생 프로필 불러오기 실패:', error);
      }
    };
    if (studentId) loadStudentProfile();
  }, [studentId]);

  useEffect(() => {
    // id가 바뀌면 새 세션처럼 초기화
    didInitTutorRef.current = false;
    setChat([]);
    setSuggested([]);
    setTutorState({ stage: 'intro', idx: 0, awaiting: 'none' });
    sessionStartTimeRef.current = Date.now();
    sessionStartedRef.current = false;
    // 🖼️ Phase 2: highlightRegion cleanup
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setCurrentHighlightRegion(null);
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.length]);

  const pageImageUrl = useMemo(() => {
    // source.imageUrl 우선, 없으면 practiceProblems[0].imageUrl
    if (rp?.source?.imageUrl) return rp.source.imageUrl;
    const p0 = rp?.reviewContent?.practiceProblems?.[0];
    return p0?.imageUrl || null;
  }, [rp]);
  
  // 🖼️ Phase 2: 현재 메시지의 하이라이트 영역
  const [currentHighlightRegion, setCurrentHighlightRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    problemNumber?: number;
  } | null>(null);

  // 진행 현황 계산
  const progressInfo = useMemo(() => {
    if (!rp) return null;
    
    const keyPoints = rp.reviewContent?.keyPoints || [];
    const practiceProblems = rp.reviewContent?.practiceProblems || [];
    const quiz = rp.reviewContent?.quiz || [];
    
    // 전체 단계 수 계산
    const totalSteps = 1 + // intro
      keyPoints.length + // keyPoints
      practiceProblems.length + // practice
      (quiz.length > 0 ? 1 : 0) + // quiz (있으면 1단계)
      1; // wrapup
    
    // 현재 단계 계산
    let currentStep = 0;
    if (tutorState.stage === 'intro') {
      currentStep = 0;
    } else if (tutorState.stage === 'keyPoints') {
      currentStep = 1 + tutorState.idx; // intro 완료 + keyPoints 진행
    } else if (tutorState.stage === 'practice') {
      currentStep = 1 + keyPoints.length + tutorState.idx; // intro + keyPoints 완료 + practice 진행
    } else if (tutorState.stage === 'quiz') {
      currentStep = 1 + keyPoints.length + practiceProblems.length; // intro + keyPoints + practice 완료
    } else if (tutorState.stage === 'wrapup') {
      currentStep = totalSteps - 1; // 마지막 단계
    }
    
    const progressPercent = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
    
    // 목차 생성
    const toc: Array<{ label: string; completed: boolean; current: boolean }> = [];
    toc.push({ label: '오늘 복습 시작', completed: tutorState.stage !== 'intro', current: tutorState.stage === 'intro' });
    
    keyPoints.forEach((kp: string, idx: number) => {
      let isCompleted: boolean;
      if (tutorState.stage === 'keyPoints') {
        isCompleted = idx < tutorState.idx;
      } else {
        isCompleted = tutorState.stage !== 'intro';
      }
      const isCurrent = tutorState.stage === 'keyPoints' && tutorState.idx === idx;
      toc.push({ label: `핵심 포인트 ${idx + 1}`, completed: isCompleted, current: isCurrent });
    });
    
    practiceProblems.forEach((_: any, idx: number) => {
      const isCompleted = tutorState.stage === 'practice' ? idx < tutorState.idx : tutorState.stage === 'quiz' || tutorState.stage === 'wrapup';
      const isCurrent = tutorState.stage === 'practice' && tutorState.idx === idx;
      toc.push({ label: `연습 문제 ${idx + 1}`, completed: isCompleted, current: isCurrent });
    });
    
    if (quiz.length > 0) {
      const isCompleted = tutorState.stage === 'wrapup';
      const isCurrent = tutorState.stage === 'quiz';
      toc.push({ label: '확인 퀴즈', completed: isCompleted, current: isCurrent });
    }
    
    toc.push({ label: '마무리', completed: tutorState.stage === 'wrapup', current: tutorState.stage === 'wrapup' });
    
    return { totalSteps, currentStep, progressPercent, toc };
  }, [rp, tutorState]);

  const push = (m: ChatMsg) => setChat((prev) => [...prev, m]);

  const fetchTutorNext = async (studentMessage?: string) => {
    setSending(true);
    try {
      // 🤖 AI Agent: 세션 시작 이벤트 (첫 번째 호출 시)
      if (!sessionStartedRef.current && studentId !== 'guest' && rp) {
        sessionStartedRef.current = true;
        trackSessionStart(studentId, id, rp.subject || rp.reviewContent?.subject);
      }
      
      const res = await fetch('/api/review-programs/tutor/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewProgramId: id,
          studentMessage: studentMessage || '',
          state: tutorState,
          studentId, // 🤖 AI 에이전트: 학생 이름 사용
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '튜터 응답 실패');
      
      if (data.message) {
        push({ 
          from: 'rang', 
          text: data.message,
          highlightRegion: data.highlightRegion || null, // 🖼️ Phase 2: 하이라이트 영역 저장
        });
        lastTutorMessageRef.current = data.message;
        
        // 🖼️ Phase 2: 하이라이트 영역 설정 (3초 후 자동 해제)
        // 이전 timeout cleanup
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = null;
        }
        
        if (data.highlightRegion) {
          setCurrentHighlightRegion(data.highlightRegion);
          highlightTimeoutRef.current = setTimeout(() => {
            setCurrentHighlightRegion(null);
            highlightTimeoutRef.current = null;
          }, 3000);
        } else {
          setCurrentHighlightRegion(null);
        }
        
        // 🤖 AI Agent: 튜터 응답 분석하여 이벤트 수집
        if (studentId !== 'guest' && rp) {
          await handleTutorMessageEvents(data.message, data.nextState, studentMessage);
        }
      }
      
      setSuggested(Array.isArray(data.suggestedReplies) ? data.suggestedReplies : []);
      if (data.nextState) {
        // 🤖 AI Agent: 상태 변경 이벤트 (concept_learned)
        if (data.nextState.stage === 'keyPoints' && data.nextState.idx !== tutorState.idx && studentId !== 'guest') {
          const keyPoints = rp.reviewContent?.keyPoints || [];
          const currentKeyPoint = keyPoints[data.nextState.idx];
          if (currentKeyPoint) {
            trackConceptLearned(studentId, id, currentKeyPoint, {
              subject: rp.subject || rp.reviewContent?.subject,
              keyPoint: currentKeyPoint,
            });
          }
        }
        
        setTutorState(data.nextState);
      }
    } catch (e) {
      console.error(e);
      push({ from: 'rang', text: '앗, 잠깐 오류가 났어 🐰 다시 한 번 말해줄래?' });
    } finally {
      setSending(false);
    }
  };
  
  // 🤖 AI Agent: 튜터 메시지 분석하여 이벤트 수집
  const handleTutorMessageEvents = async (
    tutorMessage: string,
    nextState: any,
    studentMessage?: string
  ) => {
    if (!rp || studentId === 'guest') return;
    
    const message = tutorMessage.toLowerCase();
    const subject = rp.subject || rp.reviewContent?.subject || '';
    
    // 퀴즈 정답/오답 판단
    if (tutorState.stage === 'quiz' && tutorState.awaiting === 'free_answer' && studentMessage) {
      // 정답 키워드: "딩동댕", "맞았어", "잘했어", "정답", "완전 맞았어"
      const correctKeywords = ['딩동댕', '맞았어', '잘했어', '정답', '완전 맞았어', '완벽해', '대박 정확해'];
      const incorrectKeywords = ['아깝다', '틀렸', '틀렸어', '다시 생각', '조금만 더'];
      
      const isCorrect = correctKeywords.some(keyword => message.includes(keyword.toLowerCase()));
      const isIncorrect = incorrectKeywords.some(keyword => message.includes(keyword.toLowerCase()));
      
      if (isCorrect) {
        const quiz = rp.reviewContent?.quiz || [];
        const currentQuiz = quiz[tutorState.idx];
        trackQuizCorrect(studentId, id, {
          subject,
          topic: currentQuiz?.question || '',
          difficulty: 3,
          score: 100,
        });
      } else if (isIncorrect) {
        const quiz = rp.reviewContent?.quiz || [];
        const currentQuiz = quiz[tutorState.idx];
        trackQuizIncorrect(studentId, id, {
          subject,
          topic: currentQuiz?.question || '',
          difficulty: 3,
          answer: studentMessage,
          correctAnswer: tutorState.expectedAnswer,
        });
      }
    }
  };

  useEffect(() => {
    if (!loading && rp && chat.length === 0 && !didInitTutorRef.current) {
      // 개발(Strict Mode)에서 useEffect가 2번 실행돼도 첫 멘트는 1번만 생성
      didInitTutorRef.current = true;
      fetchTutorNext('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rp]);
  
  // 🤖 AI Agent: 페이지 이탈 시 세션 종료 이벤트
  useEffect(() => {
    if (studentId === 'guest' || !sessionStartedRef.current) return;
    
    const handleBeforeUnload = () => {
      const timeSpent = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000); // 초 단위
      trackSessionEnd(studentId, id, timeSpent);
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const timeSpent = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        trackSessionEnd(studentId, id, timeSpent);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // 컴포넌트 언마운트 시에도 세션 종료
      if (sessionStartedRef.current) {
        const timeSpent = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        trackSessionEnd(studentId, id, timeSpent);
      }
      
      // 🖼️ Phase 2: highlightRegion cleanup
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
    };
  }, [studentId, id]);

  if (loading) return <div className={styles.container}>로딩 중...</div>;
  if (!rp) return <div className={styles.container}>복습 프로그램을 찾을 수 없어요.</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/home')}>
          ← 홈
        </button>
        <div>
          <h1 className={styles.title}>{rp.title}</h1>
          <div className={styles.meta}>
            {studentName && <span className={styles.studentTag}>👋 {studentName}</span>}
            {rp.durationMinutes ? `${rp.durationMinutes}분` : ''}{' '}
            {rp.createdAt ? `· ${new Date(rp.createdAt).toLocaleString('ko-KR')}` : ''}
          </div>
        </div>
      </header>

      {/* 요약본 내용 표시 (시크릿 노트인 경우) */}
      {rp.metadata?.isSecretNote && rp.reviewContent && (
        <section className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>✨ 유은서 쌤이 방금 만든 따끈따끈한 비법 노트!</h2>
            
            {/* 쌤의 한마디 */}
            {rp.reviewContent.teacherMessage && (
              <div className={styles.teacherMessage}>
                <h3>💬 쌤의 한마디</h3>
                <MarkdownMath content={rp.reviewContent.teacherMessage} />
              </div>
            )}

            {/* UNIT 제목 */}
            {rp.reviewContent.unitTitle && (
              <div className={styles.unitTitle}>
                <h3>{rp.reviewContent.unitTitle}</h3>
              </div>
            )}

            {/* 이것만 꼭 알아둬! */}
            {rp.reviewContent.conceptSummary && (
              <div className={styles.conceptSummary}>
                <h3>💡 이것만 꼭 알아둬!</h3>
                <div className={styles.conceptText}>
                  <MarkdownMath 
                    content={typeof rp.reviewContent.conceptSummary === 'string' 
                      ? rp.reviewContent.conceptSummary 
                      : JSON.stringify(rp.reviewContent.conceptSummary)
                    } 
                  />
                </div>
              </div>
            )}

            {/* 교재 강조 부분 */}
            {rp.reviewContent.textbookHighlight && (
              <div className={styles.textbookHighlight}>
                <h3>📖 쌤 Tip</h3>
                <MarkdownMath 
                  content={typeof rp.reviewContent.textbookHighlight === 'string' 
                    ? rp.reviewContent.textbookHighlight 
                    : JSON.stringify(rp.reviewContent.textbookHighlight)
                  } 
                />
              </div>
            )}

            {/* 학생 질문 정리 */}
            {rp.reviewContent.missedParts && rp.reviewContent.missedParts.length > 0 && (
              <div className={styles.missedParts}>
                <h3>❓ 학생 질문 정리</h3>
                {rp.reviewContent.missedParts.map((part: any, idx: number) => (
                  <div key={idx} className={styles.missedPartItem}>
                    <p className={styles.missedQuestion}>
                      <strong>질문:</strong> {part.question}
                    </p>
                    {part.explanation && (
                      <p className={styles.missedExplanation}>
                        <strong>설명:</strong> {part.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 오늘의 미션 */}
            {rp.reviewContent.todayMission && (
              <div className={styles.todayMission}>
                <h3>🎯 오늘의 미션</h3>
                <MarkdownMath content={rp.reviewContent.todayMission} />
              </div>
            )}

            {/* 격려 메시지 */}
            {rp.reviewContent.encouragement && (
              <div className={styles.encouragement}>
                <MarkdownMath content={rp.reviewContent.encouragement} />
              </div>
            )}

            {/* 요약본 이미지 (metadata에 저장된 이미지 URL들 또는 Room ID로 가져오기) */}
            {(rp.metadata?.imageUrls?.length > 0 || rp.metadata?.roomId) && (
              <div className={styles.summaryImages}>
                <h3>📸 교재 이미지</h3>
                <SummaryImages roomId={rp.metadata?.roomId} imageUrls={rp.metadata?.imageUrls} />
              </div>
            )}
          </div>
        </section>
      )}

      {progressInfo && (
        <>
          {/* Sticky 프로그레스 바 (항상 상단에 고정) */}
          <section className={styles.progressSticky}>
            <div className={styles.progressHeader}>
              <div className={styles.progressTitle}>진행 현황</div>
              <div className={styles.progressPercent}>{progressInfo.progressPercent}%</div>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${progressInfo.progressPercent}%` }}
              />
            </div>
          </section>

          {/* 전체 목차 (접을 수 있게) */}
          <section className={styles.progressCard}>
            <details className={styles.progressDetails}>
              <summary className={styles.progressSummary}>
                전체 목차 보기 {progressInfo.progressPercent > 0 ? `(${progressInfo.currentStep + 1}/${progressInfo.totalSteps})` : ''}
              </summary>
              <div className={styles.progressToc}>
                {progressInfo.toc.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.tocItem} ${
                      item.current ? styles.tocItemCurrent : ''
                    } ${item.completed ? styles.tocItemCompleted : ''}`}
                  >
                    <div className={styles.tocIcon}>
                      {item.completed ? '✅' : item.current ? '📌' : '○'}
                    </div>
                    <div className={styles.tocLabel}>{item.label}</div>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </>
      )}

      <section className={styles.chatCard}>
        <div className={styles.chatHeader}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarFrame}>
              <img
                className={styles.avatarImg}
                src={rp.tutor === 'joonssam' ? '/joonssam.png' : '/rangssam.png'}
                alt={rp.tutor === 'joonssam' ? '준쌤' : '랑쌤'}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const next = (e.currentTarget as HTMLImageElement)
                    .nextElementSibling as HTMLDivElement | null;
                  if (next) next.style.display = 'flex';
                }}
              />
              <div className={styles.avatarEmojiFallback}>{rp.tutor === 'joonssam' ? '👨‍🏫' : '👩‍🏫'}</div>
            </div>
            <div className={styles.avatarName}>{rp.tutor === 'joonssam' ? '준쌤' : '랑쌤'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {pageImageUrl && (
              <div
                className={styles.imageThumbnail}
                onClick={() => {
                  // 이미지 확대 모달 열기
                  const modal = document.createElement('div');
                  modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    cursor: pointer;
                  `;
                  const img = document.createElement('img');
                  img.src = pageImageUrl;
                  img.style.cssText = `
                    max-width: 90vw;
                    max-height: 90vh;
                    object-fit: contain;
                    cursor: zoom-out;
                  `;
                  modal.appendChild(img);
                  modal.onclick = () => document.body.removeChild(modal);
                  document.body.appendChild(modal);
                }}
                title="페이지 이미지 보기"
              >
                <img src={pageImageUrl} alt="페이지 썸네일" />
                <span>📄</span>
              </div>
            )}
            <div className={styles.chatTitle}>복습 수업</div>
          </div>
        </div>

        <div className={styles.chatLog}>
          {chat.map((m, idx) => {
            const isRang = m.from === 'rang';
            const tutorName = rp.tutor === 'joonssam' ? '준쌤' : '랑쌤';
            const tutorImage = rp.tutor === 'joonssam' ? '/joonssam.png' : '/rangssam.png';
            const tutorEmoji = rp.tutor === 'joonssam' ? '👨‍🏫' : '👩‍🏫';
            return (
              <div
                key={idx}
                className={`${styles.msgRow} ${isRang ? styles.msgRowRang : styles.msgRowStudent}`}
              >
                {isRang ? (
                  <div className={styles.msgAvatar}>
                    <div className={styles.avatarFrame}>
                      <img
                        className={styles.avatarImg}
                        src={tutorImage}
                        alt={tutorName}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const next = (e.currentTarget as HTMLImageElement)
                            .nextElementSibling as HTMLDivElement | null;
                          if (next) next.style.display = 'flex';
                        }}
                      />
                      <div className={styles.avatarEmojiFallback}>{tutorEmoji}</div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.msgAvatarSpacer} />
                )}

                <div
                  className={`${styles.bubble} ${isRang ? styles.bubbleRang : styles.bubbleStudent}`}
                >
                  <MarkdownMath content={m.text} />
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {suggested.length > 0 && (
          <div className={styles.suggestedRow}>
            {suggested.map((s, idx) => (
              <button
                key={idx}
                className={styles.suggestedBtn}
                disabled={sending}
                onClick={() => {
                  push({ from: 'student', text: s });
                  fetchTutorNext(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          {/* 🖼️ 이미지 썸네일 (입력 필드 왼쪽) */}
          {pageImageUrl && (
            <div className={styles.imageThumbnailInRow}>
              <div
                className={styles.rowImageThumbnail}
                onClick={() => {
                  // 이미지 확대 모달 열기
                  const modal = document.createElement('div');
                  modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.9);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    cursor: pointer;
                  `;
                  const img = document.createElement('img');
                  img.src = pageImageUrl;
                  img.style.cssText = `
                    max-width: 90vw;
                    max-height: 90vh;
                    object-fit: contain;
                    cursor: zoom-out;
                  `;
                  modal.appendChild(img);
                  modal.onclick = () => document.body.removeChild(modal);
                  document.body.appendChild(modal);
                }}
                title="페이지 이미지 보기"
              >
                <img src={pageImageUrl} alt="과외 페이지" />
              </div>
              <div className={styles.rowImageHint}>
                이미지를 보려면<br />여기를 클릭하세요! 👆
              </div>
            </div>
          )}
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="답을 적어도 되고, 수업 중 궁금한 건 언제든 물어봐 🐰"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const msg = input.trim();
                if (!msg) return;
                setInput('');
                push({ from: 'student', text: msg });
                fetchTutorNext(msg);
              }
            }}
          />
          <button
            className={styles.sendBtn}
            disabled={sending || !input.trim()}
            onClick={() => {
              const msg = input.trim();
              if (!msg) return;
              setInput('');
              push({ from: 'student', text: msg });
              fetchTutorNext(msg);
            }}
          >
            {sending ? '...' : '전송'}
          </button>
        </div>

        {/* 진행 현황 - 입력창 바로 아래 (항상 보임) */}
        {progressInfo && (
          <div className={styles.progressInChat}>
            <div className={styles.progressMini}>
              <span className={styles.progressMiniLabel}>진행</span>
              <div className={styles.progressMiniBar}>
                <div 
                  className={styles.progressMiniFill} 
                  style={{ width: `${progressInfo.progressPercent}%` }}
                />
              </div>
              <span className={styles.progressMiniPercent}>{progressInfo.progressPercent}%</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}


