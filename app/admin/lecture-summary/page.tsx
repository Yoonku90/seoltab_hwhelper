'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MarkdownMath from '@/app/components/MarkdownMath';
import VisualAidRenderer from '@/app/components/VisualAidRenderer';
import styles from './page.module.css';

function resolveString(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(trimmed);
        return typeof parsed === 'string' ? parsed : value;
      } catch {
        return value;
      }
    }
    return value;
  }
  return value ? JSON.stringify(value) : '';
}

function normalizeConceptSummary(text: string): string {
  return text.replace(/^이것만 꼭 알아둬!?\s*/i, '');
}

function splitNumberedSections(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const circled = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩','⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
  const circledMap = new Map(circled.map((c, idx) => [c, String(idx + 1)]));

  const normalizedInline = cleaned
    .replace(/([^\d])(\d{1,2})\s*([.)-])\s+/g, '$1\n$2. ')
    .replace(/([①-⑳])\s*/g, '\n$1 ');

  const lines = normalizedInline.split('\n');
  const sections: string[] = [];
  let current = '';
  let hasNumbered = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current += '\n';
      continue;
    }

    const circledMatch = trimmed.match(/^([①-⑳])\s*(.*)$/);
    const numberMatch = trimmed.match(/^(\d{1,2})\s*[.)-]\s*(.*)$/);

    let numberLabel: string | null = null;
    let rest = trimmed;

    if (circledMatch && circledMap.has(circledMatch[1])) {
      numberLabel = circledMap.get(circledMatch[1]) || null;
      rest = circledMatch[2] || '';
    } else if (numberMatch) {
      numberLabel = numberMatch[1];
      rest = numberMatch[2] || '';
    }

    if (numberLabel) {
      hasNumbered = true;
      if (current.trim()) sections.push(current.trim());
      current = `${numberLabel}. ${rest}`.trim();
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }

  if (current.trim()) sections.push(current.trim());
  if (hasNumbered && sections.length > 0) return sections;

  return normalizedInline
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[>#_-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KEYWORD_STOPWORDS = new Set([
  '오늘', '수업', '핵심', '정리', '내용', '부분', '문제', '설명', '예시', '규칙', '개념',
  '학생', '선생님', '쌤', '요약', '포인트', '중요', '정답', '이번', '이것', '그것', '또는',
  '그리고', '때문', '정리하면', '예를', '예시로', '다음', '처음', '마지막', '비교',
]);

const KEYWORD_SUFFIX_BOOST = [
  '법칙', '공식', '정리', '원리', '정의', '함수', '방정식', '그래프', '관계', '비율',
  '비례', '부등식', '명사', '동사', '형용사', '절', '구', '시제', '비교급', '최상급',
  '접속사', '관계대명사', '확률', '통계', '용액', '전압', '전류', '속도', '가속도',
  '세포', '유전', '광합성', '지형', '기후', '헌법', '국회', '미분', '적분',
];

function extractKeywordCandidates(text: string): string[] {
  return (text.match(/[A-Za-z가-힣]{2,}/g) || []).filter((token) => !KEYWORD_STOPWORDS.has(token));
}

function pickKeyTermFromText(text: string): { sentence: string; keyword: string; distractor: string } | null {
  const cleaned = stripMarkdown(text);
  const sentences = cleaned
    .split(/\n|(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) return null;

  const tokenCounts = new Map<string, number>();
  sentences.forEach((sentence) => {
    extractKeywordCandidates(sentence).forEach((token) => {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    });
  });

  let bestToken = '';
  let bestSentence = sentences[0];
  let bestScore = -1;

  sentences.forEach((sentence, sentenceIndex) => {
    const tokens = extractKeywordCandidates(sentence);
    tokens.forEach((token) => {
      const freq = tokenCounts.get(token) || 0;
      const lengthScore = Math.min(token.length, 8);
      const freqScore = freq > 1 ? (freq - 1) * 2 : 0;
      const suffixScore = KEYWORD_SUFFIX_BOOST.some((suffix) => token.endsWith(suffix)) ? 3 : 0;
      const earlyScore = sentenceIndex === 0 ? 2 : 0;
      const score = lengthScore + freqScore + suffixScore + earlyScore;

      if (score > bestScore) {
        bestScore = score;
        bestToken = token;
        bestSentence = sentence;
      }
    });
  });

  if (!bestToken) return null;

  const alternativeTokens = Array.from(tokenCounts.keys()).filter((token) => token !== bestToken);
  const distractor =
    alternativeTokens.sort((a, b) => (tokenCounts.get(b) || 0) - (tokenCounts.get(a) || 0))[0] || '다른 개념';

  return { sentence: bestSentence, keyword: bestToken, distractor };
}

function formatCardBody(text: string): string {
  return text
    .replace(/([^\d])(\d{1,2})\s*([.)-])\s+/g, '$1\n$2. ')
    .replace(/([①-⑳])\s*/g, '\n$1 ')
    .replace(/([•\-])\s+/g, '\n$1 ')
    .replace(/([.!?])\s+(?=[A-Za-z가-힣])/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function limitCardText(text: string, maxChars: number): string {
  if (!text) return text;
  if (text.length <= maxChars) return text;

  const sliced = text.slice(0, maxChars);
  const lastBreak = Math.max(
    sliced.lastIndexOf('\n'),
    sliced.lastIndexOf('. '),
    sliced.lastIndexOf('! '),
    sliced.lastIndexOf('? ')
  );

  if (lastBreak > maxChars * 0.6) {
    return sliced.slice(0, lastBreak).trim() + '…';
  }

  return sliced.trim() + '…';
}

function resolveVisualAids(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  }
  return [];
}

function normalizeSummaryObject(summary: any): any {
  if (!summary || typeof summary !== 'object') return summary;
  const fields = ['detailedContent', 'conceptSummary', 'teacherMessage', 'textbookHighlight', 'summary'];
  for (const field of fields) {
    const value = summary[field];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const hasSummaryShape = ['title', 'teacherMessage', 'unitTitle', 'detailedContent', 'textbookHighlight'].some(
              (key) => key in parsed
            );
            if (hasSummaryShape) {
              return { ...summary, ...parsed };
            }
          }
        } catch {
          // ignore
        }
      }
    }
  }
  return summary;
}

function detectGrammarChoice(text: string): { keyword: string; distractor: string } | null {
  const lower = text.toLowerCase();

  // 영어 문법 패턴만 감지 (한국어 "가장"은 제외)
  // -est, most + 명사/형용사 조합만 감지
  if (/(?:-est\b|most\s+\w+)/.test(lower) || text.includes('최상급')) {
    return { keyword: '최상급', distractor: '비교급' };
  }

  // -er, more + than 조합만 감지
  if (/(?:-er\b|more\s+\w+\s+than|than\s+\w+)/.test(lower) || (text.includes('비교급') && text.includes('than'))) {
    return { keyword: '비교급', distractor: '최상급' };
  }

  return null;
}

type CardQuizHint = {
  question?: string;
  options?: [string, string] | string[];
  answerIndex?: number;
};

function buildQuickCheck(text: string, seed: number, hint?: CardQuizHint | null, subject?: string | null): {
  question: string;
  options: [string, string];
  answerIndex: number;
} {
  if (hint && typeof hint === 'object') {
    const hintOptions = Array.isArray(hint.options) ? hint.options.slice(0, 2) : null;
    if (hint.question && hintOptions && hintOptions.length === 2) {
      const normalizedOptions: [string, string] = [String(hintOptions[0]), String(hintOptions[1])];
      const answerIndex = hint.answerIndex === 1 ? 1 : 0;
      return {
        question: hint.question,
        options: normalizedOptions,
        answerIndex,
      };
    }
  }

  // 영어 과목일 때만 영어 문법 패턴 감지
  const isEnglish = subject && (subject.includes('영어') || subject.toLowerCase().includes('english'));
  const grammarChoice = isEnglish ? detectGrammarChoice(text) : null;
  if (grammarChoice) {
    const cleaned = stripMarkdown(text);
    const sentence = cleaned.split('\n').map((line) => line.trim()).filter(Boolean)[0] || cleaned;
    const blanked = sentence.replace(grammarChoice.keyword, '___');
    const options: [string, string] =
      seed % 2 === 0
        ? [grammarChoice.keyword, grammarChoice.distractor]
        : [grammarChoice.distractor, grammarChoice.keyword];
    return {
      question: `빈칸 채우기: ${blanked}`,
      options,
      answerIndex: options[0] === grammarChoice.keyword ? 0 : 1,
    };
  }

  const picked = pickKeyTermFromText(text);
  if (!picked) {
    return { question: '빈칸 채우기: ___', options: ['핵심', '다른'], answerIndex: 0 };
  }

  const sentence = picked.sentence.replace(/^\d{1,2}\.\s*/, '').trim();
  const blanked = sentence.replace(picked.keyword, '___');
  const options: [string, string] =
    seed % 2 === 0 ? [picked.keyword, picked.distractor] : [picked.distractor, picked.keyword];
  return {
    question: `빈칸 채우기: ${blanked}`,
    options,
    answerIndex: options[0] === picked.keyword ? 0 : 1,
  };
}

function LectureSummaryPage() {
  const router = useRouter();
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [grade, setGrade] = useState('중2');
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [previousSummaryResult, setPreviousSummaryResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'cards'>('full');
  const [testMode, setTestMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [checkedCards, setCheckedCards] = useState<Record<number, boolean>>({});
  const [quizSelection, setQuizSelection] = useState<Record<number, number | null>>({});
  const [cardFlipped, setCardFlipped] = useState<Record<number, boolean>>({});
  const cardScrollRafRef = useRef<number | null>(null);
  const reviewProgramIdParam = searchParams.get('reviewProgramId');

  const generateSummary = async (forcePromptRefresh = false) => {
    if (!roomId.trim()) {
      setError('Room ID를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSummaryResult(null);

    try {
      console.log('[lecture-summary] 요약본 생성 시작, Room ID:', roomId.trim());
      
      const res = await fetch('/api/lecture/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomId.trim(), grade, testMode, forcePromptRefresh }),
      });

      console.log('[lecture-summary] API 응답 상태:', res.status, res.statusText);
      console.log('[lecture-summary] API 응답 OK:', res.ok);

      // 응답 본문을 텍스트로 먼저 읽기
      const responseText = await res.text();
      console.log('[lecture-summary] API 응답 본문 (처음 500자):', responseText.substring(0, 500));
      
      let data;
      try {
        data = responseText ? JSON.parse(responseText) : null;
        console.log('[lecture-summary] 파싱된 데이터:', {
          hasData: !!data,
          dataType: typeof data,
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : 'N/A',
        });
      } catch (jsonErr: any) {
        console.error('[lecture-summary] JSON 파싱 실패:', jsonErr.message);
        console.error('[lecture-summary] 응답 본문 전체:', responseText);
        throw new Error(`서버 응답을 파싱할 수 없습니다. 상태 코드: ${res.status}`);
      }

      if (!res.ok) {
        console.error('[lecture-summary] API 에러 응답:', {
          status: res.status,
          statusText: res.statusText,
          hasData: !!data,
          data: data,
          responseText: responseText.substring(0, 200),
        });
        
        // 에러 메시지 추출
        let errorMessage = '요약본 생성 중 오류가 발생했습니다.';
        
        if (data) {
          if (typeof data === 'object' && data !== null) {
            errorMessage = data.error || data.message || data.details || JSON.stringify(data);
          } else if (typeof data === 'string') {
            errorMessage = data;
          }
        } else if (responseText) {
          errorMessage = responseText.substring(0, 200);
        } else {
          errorMessage = `서버 오류 (${res.status} ${res.statusText})`;
        }
        
        throw new Error(errorMessage);
      }
      
      if (!data) {
        console.error('[lecture-summary] 응답 데이터가 null입니다.');
        throw new Error('서버에서 응답을 받지 못했습니다.');
      }
      
      if (!data.summary) {
        console.error('[lecture-summary] 응답 구조 오류:', {
          hasData: !!data,
          dataKeys: data && typeof data === 'object' ? Object.keys(data) : [],
          data: data,
        });
        throw new Error('서버에서 올바른 응답을 받지 못했습니다. (summary 필드 없음)');
      }

      console.log('[lecture-summary] 요약본 생성 성공');
      setSummaryResult(data);
    } catch (err: any) {
      console.error('요약본 생성 전체 에러:', err);
      setError(err.message || '요약본 생성 중 오류가 발생했습니다.');
      console.error('Summary generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateSummary();
  };

  const handleRegenerateWithUpdatedPrompt = async () => {
    if (!summaryResult) return;
    setPreviousSummaryResult(summaryResult);
    await generateSummary(true);
  };

  const getChangedSections = (prev: any, next: any): string[] => {
    if (!prev?.summary || !next?.summary) return [];
    const fields: Array<[string, string]> = [
      ['teacherMessage', '쌤의 한마디'],
      ['detailedContent', '오늘 수업 핵심 정리'],
      ['textbookHighlight', '쌤 Tip'],
      ['missedParts', '학생 질문 정리'],
      ['encouragement', '마무리 응원'],
    ];

    const normalizeValue = (value: any) => {
      if (typeof value === 'string') return value.trim();
      return JSON.stringify(value || '');
    };

    return fields
      .filter(([key]) => normalizeValue(prev.summary?.[key]) !== normalizeValue(next.summary?.[key]))
      .map(([, label]) => label);
  };

  const cardItems = useMemo(() => {
    if (!summaryResult?.summary) return [];
    const items = [
      summaryResult.summary?.teacherMessage
        ? {
            title: '💬 쌤의 한마디',
            body: limitCardText(formatCardBody(resolveString(summaryResult.summary.teacherMessage)), 320),
            checkable: false,
          }
        : null,
      ...(summaryResult.summary?.detailedContent || summaryResult.summary?.conceptSummary
        ? splitNumberedSections(
            resolveString(
              summaryResult.summary?.detailedContent ||
                normalizeConceptSummary(resolveString(summaryResult.summary?.conceptSummary || ''))
            )
          ).map((section, idx) => ({
            title: '📖 오늘 수업 핵심 정리',
            body: limitCardText(formatCardBody(section), 360),
            checkable: true,
            coreIndex: idx,
          }))
        : []),
      summaryResult.summary?.textbookHighlight
        ? {
            title: '📖 쌤 Tip',
            body: limitCardText(formatCardBody(resolveString(summaryResult.summary.textbookHighlight)), 320),
            checkable: false,
          }
        : null,
      summaryResult.summary?.missedParts && summaryResult.summary.missedParts.length > 0
        ? {
            title: '❓ 학생 질문 정리',
            body: limitCardText(formatCardBody(summaryResult.summary.missedParts
              .map((part: any) => {
                const lines = [
                  part.question ? `• 질문: ${part.question}` : '',
                  part.contextMeaning ? `  - 문맥: ${part.contextMeaning}` : '',
                  part.whatNotUnderstood ? `  - 모르던 부분: ${part.whatNotUnderstood}` : '',
                  part.whatToKnow ? `  - 알아야 할 것: ${part.whatToKnow}` : '',
                  part.explanation ? `  - 설명: ${part.explanation}` : '',
                  part.learningValue ? `  - 학습적 의미: ${part.learningValue}` : '',
                ].filter(Boolean);
                return lines.join('\n');
              })
              .join('\n\n')), 360),
            checkable: false,
          }
        : null,
      summaryResult.summary?.encouragement
        ? {
            title: '✨ 마무리 응원',
            body: limitCardText(formatCardBody(summaryResult.summary.encouragement), 240),
            checkable: false,
          }
        : null,
    ];

    return items.filter(Boolean) as Array<{ title: string; body: string; checkable: boolean; coreIndex?: number }>;
  }, [summaryResult]);

  useEffect(() => {
    setActiveCardIndex(0);
    setCheckedCards({});
    setQuizSelection({});
    setCardFlipped({});
    if (cardScrollRef.current) {
      cardScrollRef.current.scrollTo({ left: 0 });
    }
  }, [summaryResult]);

  useEffect(() => {
    if (!reviewProgramIdParam) return;

    const loadReviewProgram = async () => {
      try {
        setIsGenerating(true);
        setError(null);
        setSummaryResult(null);

        const res = await fetch(`/api/admin/summaries/${reviewProgramIdParam}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.summary) {
          const message = data?.error || '요약본을 불러오지 못했습니다.';
          throw new Error(message);
        }

        const rp = data.summary;
        const normalizedSummary = normalizeSummaryObject(rp.reviewContent || {});
        setRoomId(rp.metadata?.roomId || '');
        setGrade(rp.grade || '중2');
        setSummaryResult({
          reviewProgramId: rp._id?.toString?.() || reviewProgramIdParam,
          roomId: rp.metadata?.roomId || null,
          studentId: rp.studentId || null,
          studentName: rp.studentName || null,
          summary: normalizedSummary,
          imagesUsed: rp.metadata?.imageUrls || rp.reviewContent?.imagesInOrder || [],
          curriculumReference: rp.metadata?.curriculumReference || null,
        });
      } catch (err: any) {
        console.error('[lecture-summary] 요약본 조회 실패:', err);
        setError(err.message || '요약본을 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsGenerating(false);
      }
    };

    loadReviewProgram();
  }, [reviewProgramIdParam]);

  const scrollToCard = (index: number) => {
    const container = cardScrollRef.current;
    if (!container) return;
    const total = cardItems.length;
    if (total === 0) return;
    const clampedIndex = Math.min(Math.max(index, 0), total - 1);
    const cardWidth = container.clientWidth;
    container.scrollTo({ left: cardWidth * clampedIndex, behavior: 'smooth' });
  };

  const handleCardScroll = () => {
    const container = cardScrollRef.current;
    if (!container || container.children.length === 0) return;

    if (cardScrollRafRef.current) {
      cancelAnimationFrame(cardScrollRafRef.current);
    }

    cardScrollRafRef.current = requestAnimationFrame(() => {
      const cardWidth = container.clientWidth;
      if (!cardWidth) return;
      const rawIndex = Math.round(container.scrollLeft / cardWidth);
      const clampedIndex = Math.min(Math.max(rawIndex, 0), cardItems.length - 1);
      setActiveCardIndex(clampedIndex);
    });
  };

  const toggleCardChecked = (index: number) => {
    setCheckedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleQuizSelect = (index: number, optionIndex: number, isCorrect: boolean) => {
    setQuizSelection((prev) => ({ ...prev, [index]: optionIndex }));
    if (isCorrect) {
      setCheckedCards((checked) => ({ ...checked, [index]: true }));
    }
  };

  const toggleCardFlip = (index: number) => {
    setCardFlipped((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const checkableTotal = cardItems.filter((card) => card.checkable).length;
  const checkedCount = cardItems.reduce(
    (count, card, idx) => (card.checkable && checkedCards[idx] ? count + 1 : count),
    0
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>✨ 따끈따끈 요약본 생성</h1>
        <p className={styles.subtitle}>Room ID로 수업 STT와 교재 이미지를 결합하여 10분 컷 요약본을 생성합니다.</p>
      </header>

      <main className={styles.main}>
        {!summaryResult ? (
          <>
            {/* Room ID 입력 폼 */}
            <div className={styles.searchCard}>
              <h2 className={styles.cardTitle}>요약본 생성</h2>
              <form onSubmit={handleGenerateSummary} className={styles.searchForm}>
                <div>
                  <label htmlFor="roomId" className={styles.label}>
                    Room ID
                  </label>
                  <input
                    id="roomId"
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Room ID를 입력하세요"
                    className={styles.input}
                    disabled={isGenerating}
                  />
                  <p className={styles.hint}>
                    Room ID를 입력하면 해당 수업의 STT 텍스트와 교재 이미지를 자동으로 검색하여 요약본을 생성합니다.
                  </p>
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="grade" className={styles.label}>
                    학생 학년
                  </label>
                  <select
                    id="grade"
                    className={styles.input}
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    disabled={isGenerating}
                  >
                    <option value="초1">초1</option>
                    <option value="초2">초2</option>
                    <option value="초3">초3</option>
                    <option value="초4">초4</option>
                    <option value="초5">초5</option>
                    <option value="초6">초6</option>
                    <option value="중1">중1</option>
                    <option value="중2">중2</option>
                    <option value="중3">중3</option>
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                    <option value="N수생">N수생</option>
                    <option value="일반인">일반인</option>
                  </select>
                  <p className={styles.hint}>
                    학년을 선택하면 요약본 난이도와 예시가 더 맞춤화됩니다.
                  </p>
                </div>
                <div className={styles.toggleRow}>
                  <label className={styles.toggleLabel}>
                    <input
                      type="checkbox"
                      className={styles.toggleInput}
                      checked={testMode}
                      onChange={(e) => setTestMode(e.target.checked)}
                      disabled={isGenerating}
                    />
                    테스트 모드 (STT/이미지 캐시 사용)
                  </label>
                  <p className={styles.toggleHint}>
                    같은 Room ID 재실행 시 외부 호출 없이 캐시를 재사용합니다.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isGenerating || !roomId.trim()}
                  className={styles.generateButton}
                >
                  {isGenerating ? (
                    <>
                      <div className={styles.spinner}></div>
                      <span>요약본 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>따끈따끈 요약본 생성</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className={styles.errorCard}>
                <svg className={styles.errorIcon} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className={styles.errorText}>{error}</p>
              </div>
            )}
          </>
        ) : (
          /* 요약본 결과 */
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <h2 className={styles.summaryTitle}>✨ 유은서 쌤이 방금 만든 따끈따끈한 비법 노트!</h2>
              <div className={styles.summaryActions}>
                <label className={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    disabled={isGenerating}
                  />
                  테스트 모드
                </label>
                {testMode && (
                  <button
                    onClick={handleRegenerateWithUpdatedPrompt}
                    className={styles.secondaryButton}
                    disabled={isGenerating}
                  >
                    프롬프트 변경 재생성
                  </button>
                )}
                <button
                  onClick={() => {
                    setSummaryResult(null);
                    setRoomId('');
                  }}
                  className={styles.backButton}
                >
                  새로 만들기
                </button>
              </div>
            </div>

            <div className={styles.summaryContent}>
              {/* 학생 정보 */}
              {(summaryResult.studentName || summaryResult.studentId) && (
                <div className={styles.studentInfo}>
                  {summaryResult.studentName && (
                    <span className={styles.studentName}>👤 {summaryResult.studentName}</span>
                  )}
                  {summaryResult.studentId && (
                    <span className={styles.studentId}>ID: {summaryResult.studentId}</span>
                  )}
                </div>
              )}

              {summaryResult.curriculumReference && (
                <div className={styles.curriculumSection}>
                  <h5>📚 커리큘럼 참고</h5>
                  <div className={styles.curriculumMeta}>
                    <span>학년: {summaryResult.curriculumReference.gradeLabel || '미지정'}</span>
                    <span>과목: {summaryResult.curriculumReference.subject || '미지정'}</span>
                  </div>
                  {Array.isArray(summaryResult.curriculumReference.matches) &&
                  summaryResult.curriculumReference.matches.length > 0 ? (
                    <ol className={styles.curriculumList}>
                      {summaryResult.curriculumReference.matches.map((match: any, idx: number) => (
                        <li key={`${match.course}-${match.subunitTitle}-${idx}`} className={styles.curriculumItem}>
                          <div className={styles.curriculumItemTitle}>
                            {(match.course || match.unitTitle || '단원') + ' > ' + (match.subunitTitle || '소단원')}
                          </div>
                          {match.concepts && match.concepts.length > 0 && (
                            <div className={styles.curriculumItemMeta}>
                              핵심 개념: {match.concepts.slice(0, 6).join(', ')}
                            </div>
                          )}
                          {match.matchedKeywords && match.matchedKeywords.length > 0 && (
                            <div className={styles.curriculumItemMeta}>
                              매칭 키워드: {match.matchedKeywords.slice(0, 6).join(', ')}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.curriculumEmpty}>일치하는 키워드가 없습니다.</p>
                  )}
                </div>
              )}

              <div className={styles.summaryHeader}>
                <h4>{summaryResult.summary?.title || '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]'}</h4>
                {summaryResult.reviewProgramId && (
                  <p className={styles.summaryLink}>
                    <a 
                      href={`/admin/lecture-summary?reviewProgramId=${summaryResult.reviewProgramId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      전체 보기 →
                    </a>
                  </p>
                )}
              </div>

              <div className={styles.viewToggle}>
                <button
                  className={`${styles.toggleBtn} ${viewMode === 'full' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('full')}
                >
                  전체 보기
                </button>
                <button
                  className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.toggleBtnActive : ''}`}
                  onClick={() => setViewMode('cards')}
                >
                  카드뉴스 보기
                </button>
              </div>

              {viewMode === 'cards' && (
                <div className={styles.phoneFrame}>
                  <div className={styles.phoneScreen}>
                    <div className={styles.cardControls}>
                      <button
                        className={styles.cardNavBtn}
                        type="button"
                        onClick={() => scrollToCard(activeCardIndex - 1)}
                        disabled={activeCardIndex === 0}
                      >
                        ◀
                      </button>
                      <div className={styles.cardHintText}>
                        PC에서는 휠/드래그 또는 버튼으로 넘겨주세요
                      </div>
                      <button
                        className={styles.cardNavBtn}
                        type="button"
                        onClick={() => scrollToCard(activeCardIndex + 1)}
                        disabled={activeCardIndex >= cardItems.length - 1}
                      >
                        ▶
                      </button>
                    </div>
                    {cardItems.length > 0 && (
                      <div className={styles.cardProgress}>
                        <span className={styles.cardProgressText}>
                          {activeCardIndex + 1} / {cardItems.length}
                          {checkableTotal > 0 ? ` · 확인 완료 ${checkedCount}/${checkableTotal}` : ''}
                        </span>
                        <div className={styles.cardDots}>
                          {cardItems.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              className={idx === activeCardIndex ? styles.cardDotActive : styles.cardDot}
                              aria-label={`카드 ${idx + 1}로 이동`}
                              onClick={() => scrollToCard(idx)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={styles.cardCarousel} ref={cardScrollRef} onScroll={handleCardScroll}>
                      {cardItems.map((card, idx: number) => {
                        const hint =
                          card.checkable && typeof card.coreIndex === 'number'
                            ? summaryResult?.summary?.cardQuizHints?.[card.coreIndex]
                            : null;
                        const subject = summaryResult?.curriculumReference?.subject || summaryResult?.subject || null;
                        const quickCheck = card.checkable ? buildQuickCheck(card.body, idx, hint, subject) : null;
                        const isFlipped = !!cardFlipped[idx];
                        return (
                          <div
                            key={idx}
                            className={styles.cardItem}
                            onClick={() => toggleCardFlip(idx)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleCardFlip(idx);
                              }
                            }}
                          >
                            <div
                              className={`${styles.cardInner} ${isFlipped ? styles.cardInnerFlipped : ''}`}
                            >
                              <div className={styles.cardFace}>
                                <div className={styles.cardTitleRow}>
                                  <div className={styles.cardTitle}>{card.title}</div>
                                  {checkedCards[idx] && (
                                    <span className={styles.cardCheckedBadge}>확인 완료</span>
                                  )}
                                </div>
                                <div className={styles.cardBody}>
                                  <MarkdownMath content={card.body} />
                                </div>
                                <div className={styles.cardHint}>카드를 눌러 뒤집기 →</div>
                              </div>
                              <div className={styles.cardBack}>
                                {card.checkable && quickCheck ? (
                                  <div className={styles.cardQuiz}>
                                    <div className={styles.cardQuizQuestion}>{quickCheck.question}</div>
                                    <div className={styles.cardQuizOptions}>
                                      {quickCheck.options.map((option, optionIdx) => {
                                        const selected = quizSelection[idx] === optionIdx;
                                        const isCorrect = optionIdx === quickCheck.answerIndex;
                                        const variantClass = selected
                                          ? isCorrect
                                            ? styles.cardQuizOptionCorrect
                                            : styles.cardQuizOptionWrong
                                          : styles.cardQuizOption;
                                        return (
                                          <button
                                            key={option}
                                            type="button"
                                            className={variantClass}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuizSelect(idx, optionIdx, isCorrect);
                                            }}
                                          >
                                            {option}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {quizSelection[idx] != null && (
                                      <div className={styles.cardQuizResult}>
                                        {quizSelection[idx] === quickCheck.answerIndex
                                          ? '정답이야! 👍'
                                          : '앗, 다시 생각해볼까?'}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className={styles.cardQuiz}>
                                    <div className={styles.cardQuizQuestion}>
                                      이 카드는 확인 문제가 없어요.
                                    </div>
                                  </div>
                                )}
                                <div className={styles.cardHint}>앞면으로 돌아가기 ←</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {testMode && previousSummaryResult?.summary && summaryResult?.summary && (
                <div className={styles.compareSection}>
                  <h4 className={styles.compareTitle}>🧪 프롬프트 수정 전/후 비교</h4>
                  {getChangedSections(previousSummaryResult, summaryResult).length > 0 && (
                    <div className={styles.diffList}>
                      변경된 항목: {getChangedSections(previousSummaryResult, summaryResult).join(', ')}
                    </div>
                  )}
                  <div className={styles.compareGrid}>
                    <div className={styles.compareCard}>
                      <h5>Before</h5>
                      <div className={styles.compareBlock}>
                        <strong>쌤의 한마디</strong>
                        <MarkdownMath content={resolveString(previousSummaryResult.summary?.teacherMessage || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>오늘 수업 핵심 정리</strong>
                        <MarkdownMath
                          content={resolveString(
                            previousSummaryResult.summary?.detailedContent ||
                              normalizeConceptSummary(resolveString(previousSummaryResult.summary?.conceptSummary || ''))
                          )}
                        />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>쌤 Tip</strong>
                        <MarkdownMath content={resolveString(previousSummaryResult.summary?.textbookHighlight || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>학생 질문 정리</strong>
                        <MarkdownMath content={resolveString(previousSummaryResult.summary?.missedParts || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>마무리 응원</strong>
                        <MarkdownMath content={resolveString(previousSummaryResult.summary?.encouragement || '')} />
                      </div>
                    </div>
                    <div className={styles.compareCard}>
                      <h5>After</h5>
                      <div className={styles.compareBlock}>
                        <strong>쌤의 한마디</strong>
                        <MarkdownMath content={resolveString(summaryResult.summary?.teacherMessage || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>오늘 수업 핵심 정리</strong>
                        <MarkdownMath
                          content={resolveString(
                            summaryResult.summary?.detailedContent ||
                              normalizeConceptSummary(resolveString(summaryResult.summary?.conceptSummary || ''))
                          )}
                        />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>쌤 Tip</strong>
                        <MarkdownMath content={resolveString(summaryResult.summary?.textbookHighlight || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>학생 질문 정리</strong>
                        <MarkdownMath content={resolveString(summaryResult.summary?.missedParts || '')} />
                      </div>
                      <div className={styles.compareBlock}>
                        <strong>마무리 응원</strong>
                        <MarkdownMath content={resolveString(summaryResult.summary?.encouragement || '')} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 쌤의 한마디 */}
              {viewMode === 'full' && summaryResult.summary?.teacherMessage && (
                <div className={styles.teacherMessage}>
                  <h5>💬 쌤의 한마디</h5>
                  <MarkdownMath content={summaryResult.summary.teacherMessage} />
                </div>
              )}

              {/* UNIT 제목 */}
              {viewMode === 'full' && summaryResult.summary?.unitTitle && (
                <div className={styles.unitTitle}>
                  <h4>{summaryResult.summary.unitTitle}</h4>
                </div>
              )}

              {viewMode === 'full' && summaryResult.imagesUsed && summaryResult.imagesUsed.length > 0 && (
                <div className={styles.textbookHighlight}>
                  <h5>🖼️ 수업 교재 이미지</h5>
                  <div className={styles.imageGrid}>
                    {summaryResult.imagesUsed.map((url: string, idx: number) => (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.imageItem}
                      >
                        <img src={url} alt={`교재 이미지 ${idx + 1}`} />
                        <span>이미지 {idx + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 오늘 수업 핵심 정리 (통합) */}
              {viewMode === 'full' && (summaryResult.summary?.detailedContent || summaryResult.summary?.conceptSummary) && (
                <div className={styles.detailedContent}>
                  <h5>📖 오늘 수업 핵심 정리</h5>
                  <div className={styles.detailedText}>
                    <MarkdownMath 
                      content={(() => {
                        const content = summaryResult.summary?.detailedContent || summaryResult.summary?.conceptSummary || '';
                        if (typeof content === 'string') {
                          const trimmed = content.trim();
                          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                              (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                            try {
                              const parsed = JSON.parse(trimmed);
                              return typeof parsed === 'string' ? parsed : content;
                            } catch {
                              return content;
                            }
                          }
                          return content
                            .replace(/^이것만 꼭 알아둬!?\s*/i, '')
                            .replace(/^📖?\s*오늘\s*수업\s*핵심\s*정리\s*/i, '');
                        }
                        return JSON.stringify(content);
                      })()}
                    />
                  </div>
                </div>
              )}

              {viewMode === 'full' && resolveVisualAids(summaryResult.summary?.visualAids).length > 0 && (
                <div className={styles.visualAidSection}>
                  <h5>📐 시각 자료</h5>
                  <div className={styles.visualAidGrid}>
                    {resolveVisualAids(summaryResult.summary?.visualAids).map((aid: any, idx: number) => {
                      const title = aid?.title || aid?.name || `시각 자료 ${idx + 1}`;
                      const description = aid?.description || '';
                      const shape = aid?.type ? aid : { type: aid?.type || 'geometry', data: aid?.data || aid };
                      return (
                        <div key={idx} className={styles.visualAidCard}>
                          <div className={styles.visualAidHeader}>
                            <span className={styles.visualAidTitle}>{title}</span>
                          </div>
                          {description && <p className={styles.visualAidDescription}>{description}</p>}
                          <div className={styles.visualAidCanvas}>
                            <VisualAidRenderer shape={shape} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 교재 강조 부분 */}
              {viewMode === 'full' && summaryResult.summary?.textbookHighlight && (
                <div className={styles.textbookHighlight}>
                  <h5>📖 쌤 Tip</h5>
                  <MarkdownMath 
                    content={(() => {
                      const content = summaryResult.summary.textbookHighlight;
                      if (typeof content === 'string') {
                        const trimmed = content.trim();
                        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                          try {
                            const parsed = JSON.parse(trimmed);
                            return typeof parsed === 'string' ? parsed : content;
                          } catch {
                            return content;
                          }
                        }
                        return content;
                      }
                      return JSON.stringify(content);
                    })()}
                  />
                </div>
              )}

              {/* 학생 질문 정리 */}
              {viewMode === 'full' && summaryResult.summary?.missedParts && summaryResult.summary.missedParts.length > 0 && (
                <div className={styles.missedParts}>
                  <h5>❓ 학생 질문 정리</h5>
                  {summaryResult.summary.missedParts.map((part: any, idx: number) => (
                    <div key={idx} className={styles.missedPartItem}>
                      <p className={styles.missedQuestion}>
                        <strong>질문:</strong> {part.question}
                      </p>
                      {part.contextMeaning && (
                        <p className={styles.missedExplanation}>
                          <strong>문맥:</strong> {part.contextMeaning}
                        </p>
                      )}
                      {part.whatNotUnderstood && (
                        <p className={styles.missedExplanation}>
                          <strong>모르던 부분:</strong> {part.whatNotUnderstood}
                        </p>
                      )}
                      {part.whatToKnow && (
                        <p className={styles.missedExplanation}>
                          <strong>알아야 할 것:</strong> {part.whatToKnow}
                        </p>
                      )}
                      {part.explanation && (
                        <p className={styles.missedExplanation}>
                          <strong>설명:</strong> {part.explanation}
                        </p>
                      )}
                      {part.learningValue && (
                        <p className={styles.missedExplanation}>
                          <strong>학습적 의미:</strong> {part.learningValue}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 오늘의 미션 (POC에서는 숨김) */}
              {summaryResult.summary?.todayMission && false}

              {/* 격려 메시지 */}
              {viewMode === 'full' && summaryResult.summary?.encouragement && (
                <div className={styles.encouragement}>
                  <MarkdownMath content={summaryResult.summary.encouragement} />
                </div>
              )}

              {/* 전체 요약 (fallback) */}
              {summaryResult.summary?.summary && !summaryResult.summary.teacherMessage && (
                <div className={styles.summaryText}>
                  <MarkdownMath content={summaryResult.summary.summary} />
                </div>
              )}

              <div className={styles.summaryMeta}>
                {summaryResult.reviewProgramId && (
                  <div className={styles.metaRow}>
                    <a 
                      href={`/admin/lecture-summary?reviewProgramId=${summaryResult.reviewProgramId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.programLink}
                    >
                      📝 복습 프로그램으로 이동
                    </a>
                  </div>
                )}
                <div className={styles.metaRow}>
                  <strong>Room ID:</strong> {summaryResult.roomId || '없음'}
                </div>
              </div>

              {/* 학습 완료 및 저장 버튼 */}
              <div className={styles.actionButtons}>
                <button
                  onClick={async () => {
                    if (!summaryResult.reviewProgramId) {
                      alert('저장할 요약본이 없습니다.');
                      return;
                    }

                    setIsSaving(true);
                    try {
                      // 학생 ID 가져오기 (현재는 로컬 스토리지 또는 URL 파라미터에서)
                      const studentId = searchParams.get('studentId') || localStorage.getItem('studentId') || 'unknown';
                      
                      // Review Program에 studentId 업데이트
                      const res = await fetch(`/api/admin/summaries/${summaryResult.reviewProgramId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ studentId }),
                      });

                      if (!res.ok) {
                        throw new Error('저장 실패');
                      }

                      // 로컬 스토리지에 저장 (선택사항)
                      if (studentId !== 'unknown') {
                        localStorage.setItem('studentId', studentId);
                      }

                      // 숙제 페이지로 이동
                      router.push(`/homework?studentId=${studentId}&tutor=rangsam`);
                    } catch (err: any) {
                      console.error('저장 오류:', err);
                      alert('저장 중 오류가 발생했습니다: ' + err.message);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className={styles.completeButton}
                  disabled={isSaving}
                >
                  {isSaving ? '저장 중...' : '✅ 학습 완료 및 저장 → 이제 은서쌤과 숙제하자!'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LectureSummaryPage />
    </Suspense>
  );
}

