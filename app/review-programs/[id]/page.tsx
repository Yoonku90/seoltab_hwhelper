'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import MarkdownMath from '@/app/components/MarkdownMath';
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
    
    keyPoints.forEach((kp, idx) => {
      const isCompleted = tutorState.stage === 'keyPoints' ? idx < tutorState.idx : tutorState.stage !== 'intro' && tutorState.stage !== 'keyPoints';
      const isCurrent = tutorState.stage === 'keyPoints' && tutorState.idx === idx;
      toc.push({ label: `핵심 포인트 ${idx + 1}`, completed: isCompleted, current: isCurrent });
    });
    
    practiceProblems.forEach((_, idx) => {
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
        push({ from: 'rang', text: data.message });
        lastTutorMessageRef.current = data.message;
        
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

      {pageImageUrl ? (
        <section className={styles.pageImageCard}>
          <img 
            className={styles.pageImage} 
            src={pageImageUrl} 
            alt="오늘 과외 페이지"
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
            style={{ cursor: 'pointer' }}
          />
          <div style={{ fontSize: 12, color: '#666', marginTop: 8, textAlign: 'center' }}>
            클릭하면 크게 볼 수 있어요
          </div>
        </section>
      ) : null}

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
          <div className={styles.chatTitle}>복습 수업</div>
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


