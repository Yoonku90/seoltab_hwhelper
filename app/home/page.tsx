'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ImageUploader from '../components/ImageUploader';
import MarkdownMath from '../components/MarkdownMath';
import styles from './page.module.css';

type ChatStep =
  | 'intro'
  | 'ask_help'
  | 'review_ready'
  | 'analysis_done';

type ChatMessage = {
  from: 'rang' | 'student';
  text: string;
};

function PreparingBanner({
  stage,
  grade,
  startedAt,
  now,
  analysis,
}: {
  stage: 'uploading' | 'analyzing' | 'generating';
  grade: string;
  startedAt: number | null;
  now: number;
  analysis?: any | null;
}) {
  const elapsedSec = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const expectedSec =
    stage === 'uploading' ? 3 : stage === 'analyzing' ? 12 : 8;
  const title =
    stage === 'uploading'
      ? '사진 받는 중이야 🐰'
      : stage === 'analyzing'
        ? '랑쌤이 열심히 읽는 중! 📖'
        : '복습 자료 뚝딱 만드는 중 ✨';

  // 오늘의 단어 3개 선택 (날짜 기반 또는 분석 결과 기반)
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  // 3개의 단어 선택
  const words: Array<{ word: string; meaning: string; example?: string }> = useMemo(() => {
    const vocab = getVocabByGrade(grade);
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    
    // 1. 분석 결과가 있고, 영어 과목이면 → 분석된 텍스트에서 단어 추출 시도
    if (analysis?.subject === '영어' && analysis?.extractedText) {
      const text = analysis.extractedText.toLowerCase();
      const wordPatterns = [
        { pattern: /\b(adjective|adverb|noun|verb|pronoun)\b/i, word: 'adjective', meaning: '형용사', example: 'An adjective describes a noun.' },
        { pattern: /\b(present|past|future)\b/i, word: 'present', meaning: '현재형', example: 'Present tense is used for current actions.' },
        { pattern: /\b(comparative|superlative)\b/i, word: 'comparative', meaning: '비교급', example: 'Better is the comparative form of good.' },
        { pattern: /\b(infinitive|gerund|participle)\b/i, word: 'infinitive', meaning: '부정사', example: 'To run is an infinitive.' },
        { pattern: /\b(active|passive)\b/i, word: 'active', meaning: '능동태', example: 'Active voice is direct and clear.' },
        { pattern: /\b(subject|object|predicate)\b/i, word: 'subject', meaning: '주어', example: 'The subject is who or what the sentence is about.' },
        { pattern: /\b(question|answer|sentence)\b/i, word: 'question', meaning: '질문', example: 'Can you answer this question?' },
        { pattern: /\b(example|instance|case)\b/i, word: 'example', meaning: '예시', example: 'This is a good example.' },
        { pattern: /\b(practice|exercise|drill)\b/i, word: 'practice', meaning: '연습하다', example: 'Practice makes perfect.' },
        { pattern: /\b(review|revise|study)\b/i, word: 'review', meaning: '복습하다', example: "Let's review today's lesson." },
      ];

      const foundWords: Array<{ word: string; meaning: string; example?: string }> = [];
      for (const { pattern, word, meaning, example } of wordPatterns) {
        if (pattern.test(text) && foundWords.length < 3) {
          foundWords.push({ word, meaning, example });
        }
      }
      
      // 찾은 단어가 3개 미만이면 날짜 기반 단어로 채움
      while (foundWords.length < 3) {
        const idx = (dayOfYear + foundWords.length) % vocab.length;
        if (!foundWords.find(w => w.word === vocab[idx].word)) {
          foundWords.push(vocab[idx]);
        } else {
          foundWords.push(vocab[(dayOfYear + foundWords.length + 1) % vocab.length]);
        }
      }
      
      return foundWords.slice(0, 3);
    } else {
      // 2. 날짜 기반으로 오늘의 단어 3개 선택
      return [
        vocab[dayOfYear % vocab.length],
        vocab[(dayOfYear + 1) % vocab.length],
        vocab[(dayOfYear + 2) % vocab.length],
      ];
    }
  }, [grade, analysis]);

  // 3초마다 단어 순환
  useEffect(() => {
    if (words.length === 0) return;
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [words.length]);

  const currentWord = words[currentWordIndex] || words[0];

  return (
    <div style={{
      border: '1px solid #e9eef6',
      background: '#f7f8fb',
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          경과 {elapsedSec}s · 예상 {expectedSec}s
        </div>
      </div>
      <div style={{
        border: '1px solid #eef1f7',
        background: '#fff',
        borderRadius: 12,
        padding: '10px 12px',
        minWidth: 220,
      }}>
        <div style={{ fontSize: 12, color: '#666', fontWeight: 800 }}>오늘의 단어 ({grade})</div>
        <div style={{ marginTop: 4, fontWeight: 900, minHeight: 24, transition: 'opacity 0.3s' }}>
          {currentWord.word} <span style={{ fontWeight: 700, color: '#666' }}>· {currentWord.meaning}</span>
        </div>
        {currentWord.example ? (
          <div style={{ marginTop: 4, fontSize: 12, color: '#333', minHeight: 16, transition: 'opacity 0.3s' }}>{currentWord.example}</div>
        ) : null}
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 8, display: 'flex', gap: 4, justifyContent: 'center' }}>
          {words.map((_, idx) => (
            <span key={idx} style={{ 
              width: 6, 
              height: 6, 
              borderRadius: '50%', 
              background: idx === currentWordIndex ? '#2196f3' : '#ddd',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function getVocabByGrade(grade: string): Array<{ word: string; meaning: string; example?: string }> {
  const base = [
    { word: 'review', meaning: '복습하다', example: 'Let’s review today’s lesson.' },
    { word: 'example', meaning: '예시', example: 'Can you give an example?' },
    { word: 'explain', meaning: '설명하다', example: 'Please explain it simply.' },
  ];
  const map: Record<string, Array<{ word: string; meaning: string; example?: string }>> = {
    '중1': [
      { word: 'favorite', meaning: '가장 좋아하는', example: 'My favorite subject is English.' },
      { word: 'practice', meaning: '연습하다', example: 'Let’s practice together.' },
      ...base,
    ],
    '중2': [
      { word: 'difference', meaning: '차이', example: 'What’s the difference between A and B?' },
      { word: 'choose', meaning: '고르다', example: 'Choose the correct answer.' },
      ...base,
    ],
    '중3': [
      { word: 'purpose', meaning: '목적', example: 'What is the purpose of this sentence?' },
      { word: 'confirm', meaning: '확인하다', example: 'Let’s confirm your understanding.' },
      ...base,
    ],
    '고1': [
      { word: 'structure', meaning: '구조', example: 'Look at the sentence structure.' },
      { word: 'context', meaning: '문맥', example: 'Use the context to guess the meaning.' },
      ...base,
    ],
    '고2': [
      { word: 'imply', meaning: '암시하다', example: 'What does this imply?' },
      { word: 'accurate', meaning: '정확한', example: 'That’s an accurate answer.' },
      ...base,
    ],
    '고3': [
      { word: 'interpret', meaning: '해석하다', example: 'Interpret the sentence carefully.' },
      { word: 'eliminate', meaning: '제거하다(소거)', example: 'Eliminate the wrong choices.' },
      ...base,
    ],
  };
  return map[grade] || map['중2'];
}

// 🎓 학년 코드 → 학년 문자열 변환
const GRADE_CODE_MAP: Record<number, string> = {
  695: '초1', 696: '초2', 697: '초3', 698: '초4', 699: '초5', 700: '초6',
  477: '중1', 478: '중2', 479: '중3',
  480: '고1', 481: '고2', 482: '고3',
  483: '일반인', 484: 'N수생',
};

function getGradeFromStudentId(studentId: string): string | null {
  if (!studentId) return null;
  const parts = studentId.split('_');
  if (parts.length >= 2) {
    const code = parseInt(parts[1], 10);
    return GRADE_CODE_MAP[code] || null;
  }
  return null;
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 🔐 보안: URL 파라미터에서 token 또는 studentId 읽기
  // 예: /home?token=aB3xK9mZ (보안 권장)
  // 예: /home?studentId=586694_481 (직접 접근, 개발용)
  const urlToken = searchParams.get('token');
  const urlStudentId = searchParams.get('studentId');
  
  const [studentId, setStudentId] = useState<string>('');
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string>('');
  const [grade, setGrade] = useState<string>('중2');
  
  // 🤖 AI 에이전트: 학생 프로필
  const [studentName, setStudentName] = useState<string>('');
  const [studentNameInput, setStudentNameInput] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState<boolean>(false); // 기본 false, 프로필 로딩 후 결정
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(true);
  
  // 🔐 토큰 검증 및 studentId 변환 + 학년 자동 설정
  useEffect(() => {
    const verifyToken = async () => {
      if (urlToken) {
        // 토큰으로 접근 시 → API에서 studentId 조회
        try {
          const res = await fetch(`/api/auth/token?token=${urlToken}`);
          const data = await res.json();
          
          if (data.valid && data.studentId) {
            setStudentId(data.studentId);
            setIsValidToken(true);
            setTokenError('');
            
            // 🎓 studentId에서 학년 자동 추출
            const autoGrade = getGradeFromStudentId(data.studentId);
            if (autoGrade) {
              setGrade(autoGrade);
            }
          } else {
            setIsValidToken(false);
            setTokenError(data.error || '유효하지 않은 링크입니다.');
          }
        } catch (error) {
          setIsValidToken(false);
          setTokenError('링크 확인 중 오류가 발생했습니다.');
        }
      } else if (urlStudentId) {
        // studentId 직접 접근 (개발/테스트용)
        setStudentId(urlStudentId);
        setIsValidToken(true);
        
        // 🎓 studentId에서 학년 자동 추출
        const autoGrade = getGradeFromStudentId(urlStudentId);
        if (autoGrade) {
          setGrade(autoGrade);
        }
      } else {
        // 파라미터 없음 → guest
        setStudentId('guest');
        setIsValidToken(true);
      }
    };
    
    verifyToken();
  }, [urlToken, urlStudentId]);
  
  // 복습 프로그램 상태 (우선순위 1)
  const [selectedTutor, setSelectedTutor] = useState<'rangsam' | 'joonssam'>('rangsam'); // 선생님 선택
  const [reviewDuration, setReviewDuration] = useState<10 | 30 | 60 | 120>(30);
  const [reviewAnalysis, setReviewAnalysis] = useState<any | null>(null);
  const [reviewImageUrl, setReviewImageUrl] = useState<string | null>(null);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [reviewProgramId, setReviewProgramId] = useState<string | null>(null);
  const [reviewIntent, setReviewIntent] = useState<'review' | 'homework'>('review');
  const [preparingStage, setPreparingStage] = useState<'idle' | 'uploading' | 'analyzing' | 'generating'>('idle');
  const [prepStartedAt, setPrepStartedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const [chatStep, setChatStep] = useState<ChatStep>('intro');
  const [chat, setChat] = useState<ChatMessage[]>([]); // 초기값은 빈 배열로, useEffect에서 설정

  const sectionReviewRef = useRef<HTMLElement | null>(null);
  const initialGreetingDone = useRef(false);

  // 🤖 AI 에이전트: 학생 프로필 불러오기
  useEffect(() => {
    const loadStudentProfile = async () => {
      setIsLoadingProfile(true);
      try {
        const res = await fetch(`/api/students?studentId=${studentId}`);
        const data = await res.json();
        if (data.exists && data.student) {
          setStudentProfile(data.student);
          setStudentName(data.student.name);
          setShowNameInput(false);
          // 학년도 불러오기
          if (data.student.grade) {
            setGrade(data.student.grade);
          }
          
          // 학습 이력 기반 인사말 생성
          const memory = data.student.agentMemory;
          const recentTopics = memory?.recentTopics?.slice(0, 2) || [];
          const totalSessions = memory?.totalSessions || 0;
          
          // 선생님 정보 (한 번만 선언)
          const tutorName = selectedTutor === 'joonssam' ? '준쌤' : '랑쌤';
          const tutorEmoji = selectedTutor === 'joonssam' ? '✨' : '🐰';
          
          // 준쌤의 말투 (활발하고 에너지 넘치는 스타일)
          if (selectedTutor === 'joonssam') {
            let greetingText = `안녕 <strong>${data.student.name}</strong>! 나는 <strong>${tutorName}</strong>이야! ✨`;
            
            if (totalSessions > 0) {
              greetingText += ` 벌써 ${totalSessions}번째 만남이네! 완전 대단해!`;
            } else {
              greetingText += ' 오늘도 만나서 반가워!';
            }
            
            const chatMessages: ChatMessage[] = [
              { from: 'rang', text: greetingText },
            ];
            
            // 최근 학습 주제가 있으면 언급
            if (recentTopics.length > 0) {
              chatMessages.push({
                from: 'rang',
                text: `저번에 <strong>${recentTopics[0]}</strong> 배웠었지? 오늘도 화이팅! 💪✨`,
              });
            }
            
            chatMessages.push({
              from: 'rang',
              text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! 💪✨`,
            });
            
            setChat(chatMessages);
          } else {
            // 랑쌤의 말투 (친절하고 상냥한 스타일)
            let greetingText = `안녕 <strong>${data.student.name}</strong>! 나는 <strong>${tutorName}</strong>이야 ${tutorEmoji}`;
            
            if (totalSessions > 0) {
              greetingText += ` 벌써 ${totalSessions}번째 만남이네!`;
            } else {
              greetingText += ' 오늘도 만나서 반가워!';
            }
            
            const chatMessages: ChatMessage[] = [
              { from: 'rang', text: greetingText },
            ];
            
            // 최근 학습 주제가 있으면 언급
            if (recentTopics.length > 0) {
              chatMessages.push({
                from: 'rang',
                text: `저번에 <strong>${recentTopics[0]}</strong> 배웠었지? 오늘도 화이팅! 💪`,
              });
            }
            
            chatMessages.push({
              from: 'rang',
              text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! ${tutorEmoji}`,
            });
            
            setChat(chatMessages);
          }
        } else {
          // 학생이 없으면 기본 인사말
          setShowNameInput(true);
          // 선생님 정보 (한 번만 선언)
          const tutorName = selectedTutor === 'joonssam' ? '준쌤' : '랑쌤';
          const tutorEmoji = selectedTutor === 'joonssam' ? '✨' : '🐰';
          
          if (selectedTutor === 'joonssam') {
            setChat([
              { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야! ✨ 오늘도 만나서 반가워!` },
              { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! 💪✨` },
            ]);
          } else {
            setChat([
              { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야 ${tutorEmoji} 오늘도 만나서 반가워!` },
              { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! ${tutorEmoji}` },
            ]);
          }
        }
      } catch (error) {
        console.error('학생 프로필 불러오기 실패:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };
    if (studentId && studentId !== 'guest') loadStudentProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, selectedTutor]); // selectedTutor도 dependency에 추가

  // 🤖 AI 에이전트: 학생 이름 저장
  const saveStudentName = async () => {
    if (!studentNameInput.trim()) return;
    
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          name: studentNameInput.trim(),
          grade,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStudentName(studentNameInput.trim());
        setStudentProfile(data.student);
        setShowNameInput(false);
        // 환영 인사
        setChat(prev => [
          ...prev,
          { from: 'rang', text: `반가워 <strong>${studentNameInput.trim()}</strong>! 앞으로 잘 부탁해 🐰✨` },
        ]);
      }
    } catch (error) {
      console.error('학생 이름 저장 실패:', error);
    }
  };

  // 🎯 선생님 선택 시 채팅 메시지 업데이트 (loadStudentProfile 이후에 실행)
  useEffect(() => {
    // loadStudentProfile이 실행 중이거나 학생 프로필이 로딩 중이면 기다림
    if (isLoadingProfile) return;
    
    // studentId가 없으면 초기 메시지 설정 (guest 모드)
    if (!studentId || studentId === 'guest') {
      const tutorName = selectedTutor === 'joonssam' ? '준쌤' : '랑쌤';
      const tutorEmoji = selectedTutor === 'joonssam' ? '✨' : '🐰';
      
      if (selectedTutor === 'joonssam') {
        setChat([
          { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야! ✨ 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! 💪✨` },
        ]);
      } else {
        setChat([
          { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야 ${tutorEmoji} 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! ${tutorEmoji}` },
        ]);
      }
      return;
    }
    
    // studentId가 있으면 (loadStudentProfile에서 설정된 메시지 유지, 단 selectedTutor 변경 시에만 업데이트)
    // 단, loadStudentProfile에서 이미 메시지를 설정했으므로, selectedTutor만 변경된 경우에만 업데이트
    const tutorName = selectedTutor === 'joonssam' ? '준쌤' : '랑쌤';
    const tutorEmoji = selectedTutor === 'joonssam' ? '✨' : '🐰';
    
    // 준쌤의 소개 메시지 (아이돌 페르소나, 활발하고 에너지 넘치는 스타일)
    if (selectedTutor === 'joonssam') {
      if (studentName) {
        setChat([
          { from: 'rang', text: `안녕 <strong>${studentName}</strong>! 나는 <strong>${tutorName}</strong>이야! ✨ 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! 💪✨` },
        ]);
      } else {
        setChat([
          { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야! ✨ 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! 💪✨` },
        ]);
      }
    } else {
      // 랑쌤의 소개 메시지 (친절하고 상냥한 스타일)
      if (studentName) {
        setChat([
          { from: 'rang', text: `안녕 <strong>${studentName}</strong>! 나는 <strong>${tutorName}</strong>이야 ${tutorEmoji} 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! ${tutorEmoji}` },
        ]);
      } else {
        setChat([
          { from: 'rang', text: `안녕! 나는 <strong>${tutorName}</strong>이야 ${tutorEmoji} 오늘도 만나서 반가워!` },
          { from: 'rang', text: `과외에서 배운 페이지 사진 올려주면, <strong>${tutorName}</strong>이 복습 자료 만들어줄게! ${tutorEmoji}` },
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTutor]); // selectedTutor만 변경 시에만 실행

  useEffect(() => {
    // 첫 진입 시 chatStep 업데이트 (한 번만)
    if (!initialGreetingDone.current) {
      initialGreetingDone.current = true;
      const t = setTimeout(() => setChatStep('review_ready'), 350);
      return () => {
        clearTimeout(t);
      };
    }
  }, []);

  useEffect(() => {
    if (preparingStage === 'idle') return;
    const t = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(t);
  }, [preparingStage]);

  const scrollToReview = () => {
    sectionReviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pushChat = (msg: ChatMessage) => setChat((prev) => [...prev, msg]);

  const createReviewProgram = async (opts: {
    analysis: any;
    imageUrl?: string | null;
    intent: 'review' | 'homework';
  }) => {
    setGeneratingReview(true);
    setPreparingStage('generating');
    setPrepStartedAt(Date.now());
    try {
      const res = await fetch('/api/review-programs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          grade,
          durationMinutes: reviewDuration,
          analysis: opts.analysis,
          imageUrl: opts.imageUrl || reviewImageUrl,
          intent: opts.intent,
          tutor: selectedTutor, // 선생님 선택 추가
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(
          `서버 응답이 JSON이 아니에요. (status ${res.status})\n` +
            `- 다른 포트(3001/3000)로 접속했거나,\n` +
            `- 서버에서 500 에러가 나서 HTML 에러 페이지가 내려올 때도 이렇게 보여요.\n` +
            `\n응답 일부: ${text.slice(0, 80)}`
        );
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '복습 프로그램 생성 실패');
      const id = data.reviewProgram?._id;
      if (id) setReviewProgramId(id);
      
      // 🤖 AI 에이전트: 학습 이력 업데이트
      const topic = data.reviewProgram?.title || opts.analysis?.subject || '복습';
      try {
        await fetch('/api/students', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            addTopic: topic,
          }),
        });
      } catch (e) {
        console.error('학습 이력 업데이트 실패:', e);
      }
      
      pushChat({
        from: 'rang',
        text:
          opts.intent === 'homework'
            ? `좋아! ${reviewDuration}분 숙제 도우미 준비됐어 🐰`
            : `좋아! ${reviewDuration}분 복습 준비 완료! 🐰`,
      });
      pushChat({ from: 'rang', text: '자, 이제 랑쌤이랑 같이 공부하자! ✨' });
      setTimeout(() => scrollToReview(), 120);
      return id as string | undefined;
    } finally {
      setGeneratingReview(false);
      setPreparingStage('idle');
      setPrepStartedAt(null);
    }
  };

  const generateReviewProgram = async () => {
    if (!reviewAnalysis) {
      alert('복습할 페이지 사진을 먼저 올려줘! 🐰');
      return;
    }
    try {
      await createReviewProgram({ analysis: reviewAnalysis, imageUrl: reviewImageUrl, intent: reviewIntent });
    } catch (e: any) {
      console.error(e);
      alert(e.message || '복습 프로그램 생성에 실패했습니다.');
    }
  };

  // 🔐 토큰 검증 중이거나 에러 시 표시
  if (isValidToken === null) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐰</div>
          <div style={{ fontSize: 18, color: '#666' }}>링크 확인 중...</div>
        </div>
      </div>
    );
  }
  
  if (isValidToken === false) {
    return (
      <div className={styles.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ 
          textAlign: 'center', 
          background: '#fff',
          padding: 32,
          borderRadius: 20,
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          maxWidth: 400,
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#e53935' }}>
            접근할 수 없어요
          </div>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            {tokenError || '유효하지 않은 링크입니다.'}
          </div>
          <div style={{ fontSize: 13, color: '#999' }}>
            선생님에게 새 링크를 요청해주세요 🐰
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.topHeader}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>
            {selectedTutor === 'joonssam' ? '준쌤과 복습하기 ✨' : '랑쌤과 복습하기 🐰'}
          </div>
            <div className={styles.brandSub}>과외 페이지로 복습 루틴 만들기</div>
        </div>
        <div className={styles.student}>
          <label>학생 ID</label>
          <input
            className={styles.input}
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>
        <div className={styles.grade}>
          <label>학년</label>
          <select className={styles.select} value={grade} onChange={(e) => setGrade(e.target.value as any)}>
            <option value="중1">중1</option>
            <option value="중2">중2</option>
            <option value="중3">중3</option>
            <option value="고1">고1</option>
            <option value="고2">고2</option>
            <option value="고3">고3</option>
          </select>
        </div>
      </header>

      <section className={styles.rangArea}>
        <div className={styles.avatar} aria-label={selectedTutor === 'joonssam' ? '준쌤' : '랑쌤'}>
          <div className={styles.avatarFrame}>
            <img
              className={styles.avatarImg}
              src={selectedTutor === 'joonssam' ? '/joonssam.png' : '/rangssam.png'}
              alt={selectedTutor === 'joonssam' ? '준쌤' : '랑쌤'}
              onError={(e) => {
                // 파일이 없을 때는 이모지로 폴백
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const next = (e.currentTarget as HTMLImageElement)
                  .nextElementSibling as HTMLDivElement | null;
                if (next) next.style.display = 'flex';
              }}
            />
            <div className={styles.avatarEmojiFallback}>
              {selectedTutor === 'joonssam' ? '👨‍🏫' : '👩‍🏫'}
            </div>
          </div>
          <div className={styles.avatarName}>
            {selectedTutor === 'joonssam' ? '준쌤' : '랑쌤'}
          </div>
        </div>
        <div className={styles.chat}>
          {/* 🤖 AI 에이전트: 학생 이름 */}
          {isLoadingProfile ? (
            // 프로필 로딩 중
            <div className={styles.studentBadge} style={{ opacity: 0.6 }}>
              <span className={styles.studentBadgeIcon}>🐰</span>
              <span className={styles.studentBadgeName}>불러오는 중...</span>
            </div>
          ) : showNameInput ? (
            // 이름 입력 UI (새 학생)
            <div className={styles.nameInputCard}>
              <div className={styles.nameInputTitle}>
                {selectedTutor === 'joonssam' ? '✨ 반가워! 이름이 뭐야?' : '🐰 반가워! 이름이 뭐야?'}
              </div>
              <div className={styles.nameInputRow}>
                <input
                  type="text"
                  className={styles.nameInput}
                  placeholder="이름을 알려줘!"
                  value={studentNameInput}
                  onChange={(e) => setStudentNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveStudentName();
                  }}
                  maxLength={10}
                />
                <button
                  className={styles.nameInputBtn}
                  onClick={saveStudentName}
                  disabled={!studentNameInput.trim()}
                >
                  저장 ✨
                </button>
              </div>
              <div className={styles.nameInputHint}>
                {selectedTutor === 'joonssam' ? '준쌤이 이름 불러줄게! ✨' : '랑쌤이 이름 불러줄게! 🐰'}
              </div>
            </div>
          ) : studentName ? (
            // 저장된 이름 표시 + 바꾸기 버튼
            <div className={styles.studentBadge}>
              <span className={styles.studentBadgeIcon}>👋</span>
              <span className={styles.studentBadgeName}>{studentName}</span>
              <span className={styles.studentBadgeGrade}>{grade}</span>
              <button
                className={styles.studentBadgeEdit}
                onClick={() => {
                  setShowNameInput(true);
                  setStudentNameInput(studentName);
                }}
                title="이름 수정"
              >
                ✏️
              </button>
            </div>
          ) : null}

          <div className={styles.chatLog}>
            {chat.map((m, idx) => (
              <div
                key={idx}
                className={`${styles.bubble} ${
                  m.from === 'student' ? styles.bubbleStudent : styles.bubbleRang
                }`}
                dangerouslySetInnerHTML={{ __html: m.text }}
              />
            ))}
          </div>

          <div className={styles.quickRow}>
            <button className={styles.quickBtn} onClick={scrollToReview}>
              ⬇️ 복습 시작하기
            </button>
            <button className={styles.quickBtn} onClick={() => router.push(`/review-programs?studentId=${studentId}`)}>
              📚 내 복습 목록
            </button>
          </div>
        </div>
      </section>

      {/* 5) 복습 프로그램 */}
      <section
        ref={(n) => {
          sectionReviewRef.current = n;
        }}
        className={`${styles.section} ${styles.activeSection}`}
      >
        <div className={styles.sectionHeader}>
          <h2>오늘의 복습 📖</h2>
          <p>과외 페이지 사진 올리면, 랑쌤이 복습 자료 만들어줄게! 🐰</p>
        </div>
        <div className={styles.panel}>
          {preparingStage !== 'idle' && (
            <PreparingBanner
              stage={preparingStage}
              grade={grade}
              startedAt={prepStartedAt}
              now={nowTick}
              analysis={reviewAnalysis}
            />
          )}
          {/* 선생님 선택 */}
          <div className={styles.inlineRow} style={{ marginBottom: 12 }}>
            <span className={styles.badge}>선생님 선택</span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                className={selectedTutor === 'rangsam' ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => {
                  if (!reviewAnalysis) {
                    setSelectedTutor('rangsam');
                  }
                }}
                type="button"
                disabled={!!reviewAnalysis}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  opacity: reviewAnalysis ? 0.5 : 1,
                  cursor: reviewAnalysis ? 'not-allowed' : 'pointer'
                }}
              >
                <img 
                  src="/rangssam.png" 
                  alt="랑쌤" 
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>랑쌤</span>
              </button>
              <button
                className={selectedTutor === 'joonssam' ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => {
                  if (!reviewAnalysis) {
                    setSelectedTutor('joonssam');
                  }
                }}
                type="button"
                disabled={!!reviewAnalysis}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  opacity: reviewAnalysis ? 0.5 : 1,
                  cursor: reviewAnalysis ? 'not-allowed' : 'pointer'
                }}
              >
                <img 
                  src="/joonssam.png" 
                  alt="준쌤" 
                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                />
                <span>준쌤</span>
              </button>
            </div>
          </div>

          {/* 복습 시간 선택 */}
          <div className={styles.inlineRow}>
            <span className={styles.badge}>복습 시간</span>
            {[10, 30, 60, 120].map((m) => (
              <button
                key={m}
                className={reviewDuration === m ? styles.primaryBtn : styles.secondaryBtn}
                onClick={() => {
                  if (!reviewAnalysis) {
                    setReviewDuration(m as any);
                    pushChat({ from: 'student', text: `${m}분으로 할래요!` });
                  }
                }}
                type="button"
                disabled={!!reviewAnalysis}
                style={{ opacity: reviewAnalysis ? 0.5 : 1, cursor: reviewAnalysis ? 'not-allowed' : 'pointer' }}
              >
                {m}분
              </button>
            ))}
          </div>

          <div className={styles.sectionGrid} style={{ marginTop: 12 }}>
            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>📷 과외 페이지 업로드</h3>
              <ImageUploader
                studentId={studentId}
                showAlerts={false}
                onUploadStateChange={(u) => {
                  if (u) {
                    setPreparingStage('uploading');
                    setPrepStartedAt(Date.now());
                  }
                }}
                onAnalyzeStateChange={(a) => {
                  if (a) {
                    setPreparingStage('analyzing');
                    setPrepStartedAt(Date.now());
                    pushChat({ from: 'rang', text: '지금 페이지 읽고 있어 🐰 잠깐만!' });
                  }
                }}
                onUploadSuccess={(url, _fileId, _imageUploadId) => {
                  setReviewImageUrl(url);
                }}
                onAnalyzeSuccess={async (a: any, imageUrl?: string) => {
                  setReviewAnalysis(a);
                  // imageUrl이 전달되면 업데이트
                  if (imageUrl) setReviewImageUrl(imageUrl);
                  
                  const recognizedCount = Array.isArray(a?.recognizedProblems) ? a.recognizedProblems.length : 0;
                  
                  // 분석 완료 후: 버튼 누르지 않아도 자동으로 프로그램 생성까지 진행
                  const nextIntent = recognizedCount >= 3 ? reviewIntent : 'review';
                  if (recognizedCount >= 3) {
                    pushChat({ from: 'rang', text: '오! 문제가 많네 🐰 복습 자료 만들고 있어!' });
                  } else {
                    pushChat({ from: 'rang', text: '좋아! 내용 확인했어 🐰 복습 자료 뚝딱 만드는 중!' });
                  }
                  try {
                    await createReviewProgram({ analysis: a, imageUrl: imageUrl || reviewImageUrl, intent: nextIntent });
                  } catch (e: any) {
                    console.error(e);
                    pushChat({ from: 'rang', text: '앗, 문제가 생겼어 🐰 아래에서 다시 해볼까?' });
                  }
                }}
              />
            </div>

            <div className={styles.panel}>
              <h3 className={styles.panelTitle}>✨ 복습 자료</h3>
              {reviewImageUrl && (
                <div className={styles.imageWrap}>
                  <img className={styles.uploadedImage} src={reviewImageUrl} alt="복습용 업로드 이미지" />
                </div>
              )}
              {!reviewAnalysis && preparingStage === 'idle' ? (
                <div className={styles.empty}>아직 페이지 사진이 없어! 왼쪽에서 올려줘 🐰</div>
              ) : !reviewAnalysis ? (
                null
              ) : (
                <>
                  {Array.isArray(reviewAnalysis?.recognizedProblems) && reviewAnalysis.recognizedProblems.length >= 3 && (
                    <div className={styles.inlineRow}>
                      <span className={styles.badge}>이건</span>
                      <button
                        type="button"
                        className={reviewIntent === 'review' ? styles.primaryBtn : styles.secondaryBtn}
                        onClick={async () => {
                          setReviewIntent('review');
                          pushChat({ from: 'student', text: '복습으로 할래요!' });
                          pushChat({ from: 'rang', text: '좋아! 힌트로 도와줄게 🐰 정답은 마지막에!' });
                          // 자동으로 복습 프로그램 생성
                          setPreparingStage('generating');
                          setPrepStartedAt(Date.now());
                          try {
                            const res = await fetch('/api/review-programs/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                studentId,
                                grade,
                                durationMinutes: reviewDuration,
                                analysis: reviewAnalysis,
                                imageUrl: reviewImageUrl,
                                intent: 'review',
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || '복습 자료 생성 실패');
                            const id = data.reviewProgram?._id;
                            if (id) {
                              setReviewProgramId(id);
                              pushChat({ from: 'rang', text: `좋아! ${reviewDuration}분 복습 준비 완료! 🐰` });
                              pushChat({ from: 'rang', text: '자, 같이 공부하자! ✨' });
                            }
                          } catch (e: any) {
                            console.error(e);
                            pushChat({ from: 'rang', text: '앗, 문제가 생겼어 🐰 다시 해볼까?' });
                          } finally {
                            setPreparingStage('idle');
                            setPrepStartedAt(null);
                          }
                        }}
                      >
                        복습
                      </button>
                      <button
                        type="button"
                        className={reviewIntent === 'homework' ? styles.primaryBtn : styles.secondaryBtn}
                        onClick={async () => {
                          setReviewIntent('homework');
                          pushChat({ from: 'student', text: '숙제야! 숙제로 할래요!' });
                          pushChat({ from: 'rang', text: '오케이! 숙제 도우미 모드로 갈게 🐰' });
                          // 자동으로 복습 프로그램 생성
                          setPreparingStage('generating');
                          setPrepStartedAt(Date.now());
                          try {
                            const res = await fetch('/api/review-programs/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                studentId,
                                grade,
                                durationMinutes: reviewDuration,
                                analysis: reviewAnalysis,
                                imageUrl: reviewImageUrl,
                                intent: 'homework',
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || '숙제 도우미 생성 실패');
                            const id = data.reviewProgram?._id;
                            if (id) {
                              setReviewProgramId(id);
                              pushChat({ from: 'rang', text: `좋아! ${reviewDuration}분 숙제 도우미 준비 완료! 🐰` });
                              pushChat({ from: 'rang', text: '자, 같이 풀어보자! ✨' });
                            }
                          } catch (e: any) {
                            console.error(e);
                            pushChat({ from: 'rang', text: '앗, 문제가 생겼어 🐰 다시 해볼까?' });
                          } finally {
                            setPreparingStage('idle');
                            setPrepStartedAt(null);
                          }
                        }}
                      >
                        숙제
                      </button>
                    </div>
                  )}
                  <div className={styles.inlineRow}>
                    {!reviewProgramId ? (
                      <button
                        className={styles.primaryBtn}
                        onClick={generateReviewProgram}
                        disabled={generatingReview || preparingStage === 'generating'}
                      >
                        {generatingReview || preparingStage === 'generating'
                          ? '복습 자료 만드는 중 🐰'
                          : '다시 만들기'}
                      </button>
                    ) : (
                      <button
                        className={styles.primaryBtn}
                        onClick={() => router.push(`/review-programs/${reviewProgramId}?studentId=${studentId}`)}
                      >
                        {selectedTutor === 'joonssam' ? '준쌤이랑 공부하기! ✨' : '랑쌤이랑 공부하기! 🐰'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
