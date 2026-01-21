'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import MarkdownMath from '@/app/components/MarkdownMath';
import styles from './FlashcardStudyMode.module.css';

interface Flashcard {
  id: number;
  title: string; // 앞면: 키워드/타이틀
  content: string; // 뒷면: 설명
  chapterTitle?: string; // 챕터 제목 (예: [문학 영역])
  hintText?: string; // 앞면 가이드 문구 (동적으로 생성)
  quiz?: {
    question: string; // 빈칸이 포함된 질문
    options: [string, string]; // 2개 선지
    correctIndex: number; // 정답 인덱스 (0 또는 1)
    blankText: string; // 빈칸에 들어갈 텍스트
  };
}

interface FlashcardStudyModeProps {
  summaryText: string; // 요약본 전체 텍스트
  onComplete?: () => void; // 모든 퀴즈 완료 시 콜백
  onStudyComplete?: () => void; // 학습 완료 시 콜백 (수업 완료 버튼 활성화용)
}

// 요약본 텍스트를 단락 단위로 분절하고 플래시카드로 변환
function parseSummaryToFlashcards(summaryText: string): Flashcard[] {
  if (!summaryText || !summaryText.trim()) {
    console.warn('[FlashcardStudyMode] 요약본 텍스트가 비어있습니다.');
    return [];
  }

  console.log('[FlashcardStudyMode] 파싱 시작, 텍스트 길이:', summaryText.length);
  console.log('[FlashcardStudyMode] 텍스트 미리보기:', summaryText.substring(0, 500));

  const flashcards: Flashcard[] = [];
  const lines = summaryText.split('\n');
  
  let currentChapterTitle: string | null = null;
  let currentCardTitle = '';
  let currentContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 빈 줄 처리
    if (!line) {
      if (currentContent.length > 0 && currentCardTitle) {
        currentContent.push('');
      }
      continue;
    }
    
    // 패턴 1: [영역명] - 챕터 제목
    const chapterMatch = line.match(/^\[([^\]]*(?:영역|Area))\]$/);
    if (chapterMatch) {
      // 이전 카드 저장
      if (currentCardTitle && currentContent.length > 0) {
        flashcards.push({
          id: flashcards.length,
          title: currentCardTitle,
          content: currentContent.join('\n').trim(),
          chapterTitle: currentChapterTitle || undefined,
        });
        currentContent = [];
      }
      currentChapterTitle = chapterMatch[1] || null;
      currentCardTitle = '';
      continue;
    }
    
    // 패턴 2: 번호로 시작 (1. 2. 등) - 가장 우선순위 높음
    // 예: "1. <꽃>(현대시) : '이름 불러주기'의 진짜 의미"
    const numberMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (numberMatch) {
      // 이전 카드 저장
      if (currentCardTitle && currentContent.length > 0) {
        flashcards.push({
          id: flashcards.length,
          title: currentCardTitle,
          content: currentContent.join('\n').trim(),
          chapterTitle: currentChapterTitle || undefined,
        });
      }
      // 새 카드 시작 - 번호 제거
      currentCardTitle = numberMatch[2].trim();
      currentContent = [];
      continue;
    }
    
    // 패턴 3: [작품명 (장르) : 핵심 포인트] - 영역이 아닌 경우만
    const workMatch = line.match(/^\[([^\]]+)\]/);
    if (workMatch && !workMatch[1].includes('영역') && !workMatch[1].includes('Area')) {
      // 이전 카드 저장
      if (currentCardTitle && currentContent.length > 0) {
        flashcards.push({
          id: flashcards.length,
          title: currentCardTitle,
          content: currentContent.join('\n').trim(),
          chapterTitle: currentChapterTitle || undefined,
        });
      }
      currentCardTitle = workMatch[1].trim();
      currentContent = [];
      continue;
    }
    
    // 패턴 4: 특수 기호로 시작하는 경우는 카드 제목이 아님 (내용으로 처리)
    // 🎯, 📚 등은 내용의 일부이므로 카드 제목으로 사용하지 않음
    
    // 일반 내용 (현재 카드의 내용으로 추가)
    if (currentCardTitle) {
      currentContent.push(line);
    } else {
      // 카드 제목이 없는데 내용이 나오면, 첫 줄을 제목으로 사용
      if (line.length < 150 && (line.includes(':') || line.includes('(') || line.includes('['))) {
        currentCardTitle = line;
      } else {
        // 제목으로 보이지 않으면 임시 제목 생성 후 내용으로
        if (!currentCardTitle) {
          currentCardTitle = `핵심 ${flashcards.length + 1}`;
        }
        currentContent.push(line);
      }
    }
  }
  
  // 마지막 카드 저장
  if (currentCardTitle) {
    const content = currentContent.join('\n').trim();
    if (content || !currentCardTitle.includes('핵심')) {
      flashcards.push({
        id: flashcards.length,
        title: currentCardTitle,
        content: content || currentCardTitle,
        chapterTitle: currentChapterTitle || undefined,
      });
    }
  }
  
  console.log('[FlashcardStudyMode] 파싱 완료, 카드 수:', flashcards.length);
  if (flashcards.length > 0) {
    console.log('[FlashcardStudyMode] 첫 번째 카드:', {
      title: flashcards[0].title,
      contentLength: flashcards[0].content.length,
      chapterTitle: flashcards[0].chapterTitle,
    });
  }
  
  // 카드가 없거나 너무 적으면 경고
  if (flashcards.length === 0) {
    console.warn('[FlashcardStudyMode] 플래시카드를 생성할 수 없습니다. 요약본 구조를 확인해주세요.');
    console.warn('[FlashcardStudyMode] 원본 텍스트:', summaryText.substring(0, 1000));
  }
  
  // 각 카드에 퀴즈 생성 및 가이드 문구 생성
  return flashcards.map((card) => {
    const quiz = generateQuiz(card.content);
    if (quiz) {
      card.quiz = quiz;
    }
    
    // 가이드 문구 동적 생성
    const hintText = generateHintText(card.content);
    card.hintText = hintText;
    
    return card;
  });
}

// 앞면 가이드 문구 생성 (내용에 기반)
function generateHintText(content: string): string {
  const hasInterpretation = /🎯\s*해석\s*전략|해석\s*전략/i.test(content);
  const hasApplication = /📚\s*작품\s*내\s*적용\s*예시|작품\s*내\s*적용\s*예시/i.test(content);
  const hasTeacherMethod = /🎯\s*선생님의\s*방법|선생님의\s*방법/i.test(content);
  const hasAnalysis = /🎯\s*분석\s*전략|분석\s*전략/i.test(content);
  const hasPractical = /🛠\s*실전|실전/i.test(content);
  
  const hints: string[] = [];
  
  if (hasInterpretation) {
    hints.push('해석 전략');
  }
  if (hasApplication) {
    hints.push('작품 내 적용 예시');
  }
  if (hasTeacherMethod) {
    hints.push('선생님의 방법');
  }
  if (hasAnalysis) {
    hints.push('분석 전략');
  }
  if (hasPractical) {
    hints.push('실전 문제 풀이 스킬');
  }
  
  if (hints.length > 0) {
    const hintText = hints.join(', ');
    // 받침 유무에 따라 을/를 구분
    const lastChar = hintText[hintText.length - 1];
    const lastCharCode = lastChar.charCodeAt(0);
    const hasJongseong = (lastCharCode - 0xAC00) % 28 !== 0;
    const particle = hasJongseong ? '을' : '를';
    return `${hintText}${particle} 떠올려 봐!`;
  }
  
  return '핵심 개념, 예시, 주의/예외를 각각 떠올려';
}

// 설명 텍스트에서 퀴즈 생성 (핵심 키워드를 빈칸으로)
function generateQuiz(content: string): Flashcard['quiz'] | null {
  if (!content || content.trim().length < 20) {
    return null; // 내용이 너무 짧으면 퀴즈 생성 안 함
  }
  
  // 섹션 타이틀은 빈칸으로 만들지 않도록 제외
  // 실제 내용에서만 키워드 추출
  let contentForQuiz = content;
  
  // 마크다운 제거
  const cleanContent = contentForQuiz
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/🎯|📚|💡|📖|✨|❓|💬/g, '') // 이모지 제거
    .trim();
  
  if (cleanContent.length < 15) {
    return null;
  }
  
  // 섹션 타이틀 키워드 제외 목록 (빈칸으로 만들지 않을 단어들)
  const excludedTitles = [
    '해석 전략', '선생님의 방법', '분석 전략', '작품 내 적용', '작품 내 적용 예시', 
    '작품 내 적용 사례', '실전 문제', '실전 풀이', '10분 복습', '복습 과제'
  ];
  
  // 핵심 키워드 추출 - 명사만 추출 (교육과정 개념)
  // 명사형 어미 패턴: ~법, ~식, ~리, ~칙, ~율, ~음, ~자, ~점, ~물, ~제, ~사 등
  const nounPatterns = [
    /[가-힣]+법/g,  // 설의법, 직설법 등
    /[가-힣]+식/g,  // 방정식, 부등식 등
    /[가-힣]+리/g,  // 원리, 정리 등
    /[가-힣]+칙/g,  // 법칙 등
    /[가-힣]+율/g,  // 비율 등
    /[가-힣]+음/g,  // 자음, 모음 등
    /[가-힣]+자/g,  // 화자, 서술자 등
    /[가-힣]+점/g,  // 시점 등
    /[가-힣]+물/g,  // 인물 등
    /[가-힣]+제/g,  // 시제 등
    /[가-힣]+사/g,  // 명사, 동사, 형용사 등
    /[가-힣]+철/g,  // 연철, 분철 등
  ];
  
  // 교육과정 명사 개념 목록
  const educationNouns = [
    '법칙', '공식', '정리', '원리', '정의', '함수', '방정식', '그래프', '관계', '비율',
    '비례', '부등식', '명사', '동사', '형용사', '절', '구', '시제', '비교급', '최상급',
    '설의법', '서술자', '개입', '전지적', '시점', '연철', '분철', '모음', '자음',
    '작품', '시', '소설', '수필', '희곡', '화자', '인물', '주제', '정서', '직설법',
    '현대시', '고전시가', '현대소설', '고전소설', '수필', '희곡', '시나리오',
  ];
  
  // 명사만 추출 (교육과정 개념)
  let targetKeyword = '';
  let targetSentence = '';
  
  const sentences = cleanContent.split(/[.!?。\n]/).filter(s => {
    const trimmed = s.trim();
    // 섹션 타이틀이 포함된 문장은 제외
    return trimmed.length > 10 && !excludedTitles.some(title => trimmed.includes(title));
  });
  
  // 1순위: 교육과정 명사 개념 찾기
  for (const sentence of sentences) {
    if (excludedTitles.some(title => sentence.includes(title))) {
      continue;
    }
    
    for (const noun of educationNouns) {
      if (sentence.includes(noun)) {
        targetKeyword = noun;
        targetSentence = sentence.trim();
        break;
      }
    }
    if (targetKeyword) break;
  }
  
  // 2순위: 명사 패턴으로 찾기
  if (!targetKeyword) {
    for (const sentence of sentences) {
      if (excludedTitles.some(title => sentence.includes(title))) {
        continue;
      }
      
      for (const pattern of nounPatterns) {
        const matches = sentence.match(pattern);
        if (matches && matches.length > 0) {
          // 가장 긴 명사 선택
          const noun = matches.sort((a, b) => b.length - a.length)[0];
          if (noun && noun.length >= 2 && noun.length <= 6) {
            targetKeyword = noun;
            targetSentence = sentence.trim();
            break;
          }
        }
      }
      if (targetKeyword) break;
    }
  }
  
  // 3순위: 자주 나오는 명사형 단어 찾기 (2-4글자)
  if (!targetKeyword) {
    const words = cleanContent.match(/[가-힣]{2,4}/g) || [];
    const wordCounts = new Map<string, number>();
    
    words.forEach(word => {
      const isExcluded = excludedTitles.some(title => title.includes(word) || word.includes(title.split(' ')[0]));
      // 명사형 어미를 가진 단어 우선
      const isNounLike = nounPatterns.some(pattern => pattern.test(word)) || 
                        educationNouns.some(noun => word.includes(noun) || noun.includes(word));
      if (word.length >= 2 && word.length <= 4 && !isExcluded && isNounLike) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });
    
    // 가장 자주 나오는 단어 찾기 (2번 이상)
    let maxCount = 0;
    for (const [word, count] of wordCounts.entries()) {
      if (count >= 2 && count > maxCount) {
        maxCount = count;
        targetKeyword = word;
      }
    }
  }
  
  if (!targetKeyword || targetKeyword.length < 2) {
    return null; // 키워드를 찾지 못하면 퀴즈 생성 안 함
  }
  
  // 빈칸으로 대체한 질문 생성
  const questionText = targetSentence || cleanContent.split(/[.!?。\n]/)[0] || cleanContent;
  let question = questionText.replace(targetKeyword, '___');
  
  if (question === questionText) {
    // 대체가 안 되었으면 전체 내용에서 대체
    const question2 = cleanContent.replace(new RegExp(targetKeyword, 'g'), '___');
    if (question2 === cleanContent) {
      return null; // 대체 실패
    }
    question = question2;
  }
  
  if (!question || question.length < 5) {
    return null; // 질문이 너무 짧으면 퀴즈 생성 안 함
  }
  
  // 오답 선지 생성
  const distractor = generateDistractor(targetKeyword, cleanContent, excludedTitles);
  
  // 선지 순서 랜덤화
  const isCorrectFirst = Math.random() > 0.5;
  const options: [string, string] = isCorrectFirst
    ? [targetKeyword, distractor]
    : [distractor, targetKeyword];
  
  return {
    question: question.length > 100 ? question.substring(0, 100) + '...' : question,
    options,
    correctIndex: isCorrectFirst ? 0 : 1,
    blankText: targetKeyword,
  };
}

// 오답 선지 생성 (교육과정에서 대비되는 개념 또는 반의어)
function generateDistractor(correct: string, content: string, excludedTitles: string[]): string {
  // 교육과정 대비 개념 사전
  const contrastPairs: Record<string, string> = {
    // 문법
    '비교급': '최상급',
    '최상급': '비교급',
    '설의법': '직설법',
    '직설법': '설의법',
    '연철': '분철',
    '분철': '연철',
    '모음': '자음',
    '자음': '모음',
    '양성': '음성',
    '음성': '양성',
    '전지적': '1인칭',
    '1인칭': '전지적',
    // 문학
    '현대시': '고전시가',
    '고전시가': '현대시',
    '현대소설': '고전소설',
    '고전소설': '현대소설',
    '시': '소설',
    '소설': '시',
    '화자': '서술자',
    '서술자': '화자',
    // 수학
    '방정식': '부등식',
    '부등식': '방정식',
    '비례': '반비례',
    '반비례': '비례',
    '법칙': '원리',
    '원리': '법칙',
    '공식': '정리',
    '정리': '공식',
    // 일반
    '명사': '동사',
    '동사': '명사',
    '형용사': '부사',
    '부사': '형용사',
  };
  
  // 1순위: 대비되는 개념 찾기
  if (contrastPairs[correct]) {
    return contrastPairs[correct];
  }
  
  // 2순위: 내용에서 비슷한 길이의 다른 명사 찾기
  const words = content.match(/[가-힣]{2,6}/g) || [];
  const candidates = words.filter(w => 
    w !== correct && 
    w.length === correct.length &&
    !excludedTitles.some(title => title.includes(w))
  );
  
  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  
  // 3순위: 반의어 패턴 찾기
  const antonyms: Record<string, string> = {
    '긍정': '부정',
    '부정': '긍정',
    '상승': '하락',
    '하락': '상승',
    '증가': '감소',
    '감소': '증가',
    '앞': '뒤',
    '뒤': '앞',
  };
  
  if (antonyms[correct]) {
    return antonyms[correct];
  }
  
  // 4순위: 기본 오답
  return '다른 개념';
}

export default function FlashcardStudyMode({ summaryText, onComplete, onStudyComplete }: FlashcardStudyModeProps) {
  const flashcards = useMemo(() => parseSummaryToFlashcards(summaryText), [summaryText]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Map<number, number>>(new Map());
  const [quizCorrect, setQuizCorrect] = useState<Map<number, boolean>>(new Map());
  const [showQuiz, setShowQuiz] = useState(false);
  const [comboCount, setComboCount] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [allCompleted, setAllCompleted] = useState(false);
  const [unsureCards, setUnsureCards] = useState<Set<number>>(new Set()); // 잘 모르겠어 선택한 카드들
  const comboTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const quizTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentCard = flashcards[currentIndex];
  const isFlipped = flippedCards.has(currentIndex);
  const hasQuiz = currentCard?.quiz !== undefined;
  const isQuizAnswered = quizAnswers.has(currentIndex);
  const isQuizCorrect = quizCorrect.get(currentIndex) === true;
  const canProceed = isFlipped && (!hasQuiz || isQuizAnswered);

  // 진행률 계산
  const progress = flashcards.length > 0 
    ? (currentIndex + 1) / flashcards.length 
    : 0;

  // 모든 퀴즈 완료 여부 확인
  useEffect(() => {
    const allQuizzesAnswered = flashcards.every((card, idx) => {
      if (!card.quiz) return true; // 퀴즈가 없는 카드는 완료로 간주
      return quizAnswers.has(idx) && quizCorrect.get(idx) === true;
    });
    
    if (allQuizzesAnswered && flashcards.length > 0) {
      setAllCompleted(true);
      if (onStudyComplete) {
        onStudyComplete();
      }
    }
  }, [flashcards, quizAnswers, quizCorrect, onComplete]);

  const handleCardFlip = (isUnsure: boolean = false) => {
    // 앞면이면 뒷면으로
    if (!isFlipped) {
      setFlippedCards(prev => new Set(prev).add(currentIndex));
      if (isUnsure) {
        setUnsureCards(prev => new Set(prev).add(currentIndex));
      }
    } else {
      // 뒷면이면 앞면으로
      setFlippedCards(prev => {
        const newSet = new Set(prev);
        newSet.delete(currentIndex);
        return newSet;
      });
    }
  };

  const handleNext = () => {
    if (!isFlipped) return; // 뒷면이 아니면 동작하지 않음
    
    // 다음 카드로 이동
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowQuiz(false);
    }
  };

  const handlePrev = () => {
    if (!isFlipped) return; // 뒷면이 아니면 동작하지 않음
    
    // 이전 카드로 이동
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowQuiz(false);
    }
  };

  const handleNextButtonClick = () => {
    if (!isFlipped) return;
    
    // 다음 버튼 클릭 시 퀴즈 표시
    if (hasQuiz && !isQuizAnswered) {
      setShowQuiz(true);
    } else if (currentIndex < flashcards.length - 1) {
      handleNext();
    }
  };
  
  // 카드 변경 시 뒤집기 상태 초기화
  useEffect(() => {
    // 새 카드로 이동했을 때 뒤집기 상태 초기화 (사용자가 직접 뒤집어야 함)
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentIndex);
      return newSet;
    });
    setShowQuiz(false);
  }, [currentIndex]);

  const handleQuizAnswer = (optionIndex: number) => {
    if (!currentCard?.quiz) return;
    
    const isCorrect = optionIndex === currentCard.quiz.correctIndex;
    
    // 이미 답을 선택했고 정답이면 다시 선택 불가
    if (isQuizAnswered && isQuizCorrect) {
      return;
    }
    
    setQuizAnswers(prev => new Map(prev).set(currentIndex, optionIndex));
    
    if (isCorrect) {
      // 정답: 콤보 증가 및 1초 후 자동 이동
      setQuizCorrect(prev => new Map(prev).set(currentIndex, true));
      setComboCount(prev => {
        const newCombo = prev + 1;
        setShowCombo(true);
        if (comboTimeoutRef.current) {
          clearTimeout(comboTimeoutRef.current);
        }
        comboTimeoutRef.current = setTimeout(() => {
          setShowCombo(false);
        }, 2000);
        return newCombo;
      });
      
      // 1초 후 자동 이동
      if (quizTimeoutRef.current) {
        clearTimeout(quizTimeoutRef.current);
      }
      quizTimeoutRef.current = setTimeout(() => {
        if (currentIndex < flashcards.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setShowQuiz(false);
          setFlippedCards(prev => {
            const newSet = new Set(prev);
            newSet.delete(currentIndex);
            return newSet;
          });
        }
      }, 1000);
    } else {
      // 오답: 콤보 리셋, 정답 표시 안 함
      setQuizCorrect(prev => {
        const newMap = new Map(prev);
        newMap.delete(currentIndex); // 정답 표시 안 함
        return newMap;
      });
      setComboCount(0);
      setShowCombo(false);
    }
  };

  // 정리
  useEffect(() => {
    return () => {
      if (comboTimeoutRef.current) {
        clearTimeout(comboTimeoutRef.current);
      }
      if (quizTimeoutRef.current) {
        clearTimeout(quizTimeoutRef.current);
      }
    };
  }, []);

  if (flashcards.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>플래시카드를 생성할 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const handleDownloadFullText = async () => {
    try {
      // html2canvas를 동적으로 import
      const html2canvas = (await import('html2canvas')).default;
      
      // 풀 텍스트 컨테이너 생성
      const fullTextContainer = document.createElement('div');
      fullTextContainer.style.width = '1080px';
      fullTextContainer.style.padding = '40px';
      fullTextContainer.style.background = 'white';
      fullTextContainer.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      fullTextContainer.style.color = '#333';
      
      // 플래시카드 데이터로 이미지 생성
      const cardsHtml = flashcards.map((card, idx) => {
        const isUnsure = unsureCards.has(idx);
        const titleStyle = isUnsure 
          ? 'font-size: 20px; color: #764ba2; margin-top: 20px; margin-bottom: 10px; padding: 10px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;'
          : 'font-size: 20px; color: #764ba2; margin-top: 20px; margin-bottom: 10px;';
        const unsureBadge = isUnsure ? '<span style="background: #ffc107; color: white; padding: 4px 8px; border-radius: 4px; font-size: 14px; margin-left: 10px;">😅 잘 모르겠어</span>' : '';
        
        return `
          <div style="margin-bottom: 30px;">
            <h3 style="${titleStyle}">
              ${card.title}${unsureBadge}
            </h3>
            <div style="line-height: 1.8; font-size: 16px; color: #333;">
              ${card.content.split('\n').map(line => {
                if (line.trim()) {
                  return `<p style="margin-bottom: 8px;">${line}</p>`;
                }
                return '<br/>';
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
      
      fullTextContainer.innerHTML = `
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="font-size: 36px; color: #667eea; margin-bottom: 10px;">✨ 오늘 배운 내용 정리</h1>
          <p style="font-size: 18px; color: #666;">${new Date().toLocaleDateString('ko-KR')}</p>
        </div>
        <div style="line-height: 1.8; font-size: 18px;">
          ${cardsHtml}
        </div>
      `;
      
      document.body.appendChild(fullTextContainer);
      
      // 이미지 생성
      const canvas = await html2canvas(fullTextContainer, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      
      // 다운로드
      const link = document.createElement('a');
      link.download = `오늘배운내용_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      // 정리
      document.body.removeChild(fullTextContainer);
    } catch (error) {
      console.error('이미지 생성 실패:', error);
      alert('이미지 생성에 실패했습니다. 풀 텍스트 보기로 이동합니다.');
      if (onComplete) onComplete();
    }
  };

  if (allCompleted) {
    return (
      <div className={styles.container}>
        <div className={styles.completionScreen}>
          <h2>🎉 모든 퀴즈를 완료했어요!</h2>
          <p>이제 풀 텍스트 버전을 확인할 수 있어요.</p>
          <div className={styles.completionButtons}>
            <button 
              className={styles.completeButton}
              onClick={handleDownloadFullText}
            >
              📸 이미지로 저장하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 진행바 */}
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      
      {/* 학습 영역 */}
      <div className={styles.studyArea}>
        {/* 챕터 타이틀 및 진행률 */}
        {currentCard?.chapterTitle && (
          <div className={styles.chapterTitle}>
            {currentCard.chapterTitle} ({currentIndex + 1}/{flashcards.length})
          </div>
        )}
        
        {/* 진행률 정보 (챕터 타이틀이 없을 때만) */}
        {!currentCard?.chapterTitle && (
          <div className={styles.progressInfo}>
            {currentIndex + 1} / {flashcards.length}
          </div>
        )}
        
        {/* 콤보 애니메이션 */}
        {showCombo && comboCount >= 1 && (
          <div className={styles.comboAnimation}>
            <div className={styles.comboText}>
              {comboCount} COMBO! 🔥
            </div>
          </div>
        )}
        
        {/* 플래시카드 */}
        <div className={styles.cardContainer}>
          {/* 이전 버튼 (뒷면일 때만, 첫 장이 아닐 때) */}
          {isFlipped && currentIndex > 0 && (
            <button
              className={styles.cardNavButton}
              onClick={handlePrev}
              aria-label="이전 카드"
            >
              ◀
            </button>
          )}
          
          <div 
            className={`${styles.card} ${isFlipped ? styles.cardFlipped : ''}`}
            onClick={() => {
              // 뒷면일 때만 클릭으로 앞면으로 돌아가기
              if (isFlipped) {
                handleCardFlip(false);
              }
            }}
          >
            <div className={styles.cardInner}>
              {/* 앞면 */}
              <div className={styles.cardFront}>
                <div className={styles.cardTitle}>{currentCard.title}</div>
                <div className={styles.cardHint}>
                  어떤 내용이었는지 속으로 생각하고 카드를 뒤집어 봐!<br />
                  {currentCard.hintText ?? '핵심 개념, 예시, 주의/예외를 각각 떠올려'}
                </div>
                {!isFlipped && (
                  <div className={styles.cardFlipButtons}>
                    <button
                      className={styles.flipButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardFlip(false);
                      }}
                    >
                      알 것 같아! 😎
                    </button>
                    <button
                      className={`${styles.flipButton} ${styles.flipButtonUnsure}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardFlip(true);
                      }}
                    >
                      잘 모르겠어! 😅
                    </button>
                  </div>
                )}
              </div>
              
              {/* 뒷면 */}
              <div className={styles.cardBack}>
                <div className={styles.cardBackTitle}>{currentCard.title}</div>
                <div className={styles.cardContent}>
                  <MarkdownMath content={currentCard.content} />
                </div>
              </div>
            </div>
          </div>
          
          {/* 다음 버튼 (뒷면일 때만, 마지막 장이 아닐 때) */}
          {isFlipped && currentIndex < flashcards.length - 1 && (
            <button
              className={styles.cardNavButton}
              onClick={handleNextButtonClick}
              aria-label="다음 카드"
            >
              ▶
            </button>
          )}
        </div>
      </div>
      
      {/* 퀴즈 팝업 */}
      {showQuiz && currentCard?.quiz && (
        <div className={styles.quizOverlay} onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowQuiz(false);
          }
        }}>
          <div className={styles.quizPopup}>
            <div className={styles.quizQuestion}>
              <MarkdownMath content={currentCard.quiz.question} />
            </div>
            <div className={styles.quizOptions}>
              {currentCard.quiz.options.map((option, idx) => {
                const isSelected = quizAnswers.get(currentIndex) === idx;
                const isCorrect = idx === currentCard.quiz!.correctIndex;
                const isAnswered = isQuizAnswered;
                const isCorrectAnswer = isQuizCorrect;
                
                let optionClass = styles.quizOption;
                // 정답을 맞췄으면 정답 표시
                if (isAnswered && isCorrectAnswer && isCorrect) {
                  optionClass = styles.quizOptionCorrect;
                } else if (isSelected && !isCorrect) {
                  // 오답 선택 시 빨갛게 표시
                  optionClass = styles.quizOptionWrong;
                }
                
                return (
                  <button
                    key={idx}
                    className={optionClass}
                    onClick={() => handleQuizAnswer(idx)}
                    disabled={isAnswered && isCorrectAnswer && isCorrect}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {isQuizAnswered && isQuizCorrect && (
              <div className={styles.quizResult}>
                정답이에요! 🎉
              </div>
            )}
            {isQuizAnswered && !isQuizCorrect && (
              <div className={styles.quizResultWrong}>
                다시 생각해볼까요? 다른 답을 선택해보세요.
              </div>
            )}
          </div>
        </div>
      )}
      
    </div>
  );
}
