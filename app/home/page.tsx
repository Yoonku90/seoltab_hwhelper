'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownMath from '../components/MarkdownMath';
import styles from './page.module.css';

type SummaryResult = {
  reviewProgramId?: string;
  studentId?: string;
  studentName?: string;
  imagesUsed?: string[];
  summary?: {
    title?: string;
    teacherMessage?: string;
    unitTitle?: string;
    conceptSummary?: string;
    detailedContent?: string;
    textbookHighlight?: string;
    missedParts?: Array<{
      question?: string;
      contextMeaning?: string;
      whatNotUnderstood?: string;
      whatToKnow?: string;
      explanation?: string;
    }>;
    todayMission?: string;
    encouragement?: string;
  };
};

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

  const matches = [...cleaned.matchAll(/(?:^|\n)\s*(\d+)\.\s+/g)];
  if (matches.length <= 1) return [cleaned];

  const sections: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? cleaned.length) : cleaned.length;
    const slice = cleaned.slice(start, end).trim();
    if (slice) sections.push(slice);
  }
  return sections.length > 0 ? sections : [cleaned];
}

export default function HomePage() {
  const router = useRouter();
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const [roomId, setRoomId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
  const [viewMode, setViewMode] = useState<'full' | 'cards'>('full');
  const [testMode, setTestMode] = useState(false);

  const handleGenerateSummary = async () => {
    if (!roomId.trim()) {
      setError('Room ID를 입력해주세요.');
      return;
    }
    setError(null);
    setIsGenerating(true);
    setSummaryResult(null);

    try {
      const res = await fetch('/api/lecture/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: roomId.trim(), testMode }),
      });

      let data: SummaryResult | null = null;
      try {
        data = await res.json();
      } catch {
        const text = await res.text();
        throw new Error(text || '서버 응답을 파싱할 수 없습니다.');
      }

      if (!res.ok || !data) {
        throw new Error((data as any)?.error || '요약본 생성 실패');
      }

      setSummaryResult(data);
    } catch (err: any) {
      setError(err.message || '요약본 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteAndGoHomework = async () => {
    if (!summaryResult?.reviewProgramId) {
      router.push('/homework?studentId=guest&tutor=rangsam');
      return;
    }

    const studentParam = summaryResult.studentId || 'guest';

    const hookMessage =
      '시크릿 노트 다봤어? 내가 숙제 시간 반으로 줄여줄게. 이것까지 얼른 끝내자! 어때?';
    const proceed = window.confirm(hookMessage);
    if (!proceed) return;

    try {
      await fetch('/api/learning/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentParam,
          reviewProgramId: summaryResult.reviewProgramId,
          roomId: roomId.trim(),
        }),
      });
    } catch (err) {
      console.error('학습 완료 기록 실패:', err);
    }

    router.push(`/homework?studentId=${studentParam}&tutor=rangsam`);
  };

  return (
    <div className={styles.container}>
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>✨ 따끈따끈 요약본 생성 (POC)</h2>
          <p>Room ID → STT+이미지 → 요약본 → 학습 완료 → 숙제</p>
        </div>
        <div className={styles.inlineRow}>
          <input
            className={styles.input}
            placeholder="Room ID를 입력하세요"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button className={styles.primaryBtn} onClick={handleGenerateSummary} disabled={isGenerating}>
            {isGenerating ? '생성 중...' : '요약본 생성'}
          </button>
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
        {error && <p style={{ color: '#d32f2f', marginTop: 8 }}>{error}</p>}
      </section>

      {summaryResult?.summary && (
        <section className={`${styles.section} ${styles.activeSection}`}>
          <div className={styles.sectionHeader}>
            <h2>{summaryResult.summary.title || '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]'}</h2>
            {summaryResult.studentName && (
              <p>👤 {summaryResult.studentName} {summaryResult.studentId ? `(${summaryResult.studentId})` : ''}</p>
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
                    onClick={() =>
                      cardScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
                    }
                  >
                    ◀
                  </button>
                  <div className={styles.cardHintText}>
                    PC에서는 휠/드래그 또는 버튼으로 넘겨주세요
                  </div>
                  <button
                    className={styles.cardNavBtn}
                    type="button"
                    onClick={() =>
                      cardScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
                    }
                  >
                    ▶
                  </button>
                </div>
                <div className={styles.cardCarousel} ref={cardScrollRef}>
              {[
                summaryResult.summary.teacherMessage
                  ? { title: '💬 쌤의 한마디', body: resolveString(summaryResult.summary.teacherMessage) }
                  : null,
                ...(summaryResult.summary.detailedContent || summaryResult.summary.conceptSummary
                  ? splitNumberedSections(
                      resolveString(
                        summaryResult.summary.detailedContent ||
                          normalizeConceptSummary(resolveString(summaryResult.summary.conceptSummary || ''))
                      )
                    ).map((section, idx) => ({
                      title: `📖 오늘 수업 핵심 정리 ${idx + 1}`,
                      body: section,
                    }))
                  : []),
                summaryResult.summary.textbookHighlight
                  ? { title: '📖 쌤 Tip', body: resolveString(summaryResult.summary.textbookHighlight) }
                  : null,
                summaryResult.summary.missedParts && summaryResult.summary.missedParts.length > 0
                  ? {
                      title: '❓ 학생 질문 정리',
                      body: summaryResult.summary.missedParts
                        .map((part) => {
                          const lines = [
                            part.question ? `• 질문: ${part.question}` : '',
                            part.contextMeaning ? `  - 문맥: ${part.contextMeaning}` : '',
                            part.whatNotUnderstood ? `  - 모르던 부분: ${part.whatNotUnderstood}` : '',
                            part.whatToKnow ? `  - 알아야 할 것: ${part.whatToKnow}` : '',
                            part.explanation ? `  - 설명: ${part.explanation}` : '',
                          ].filter(Boolean);
                          return lines.join('\n');
                        })
                        .join('\n\n'),
                    }
                  : null,
                summaryResult.imagesUsed && summaryResult.imagesUsed.length > 0
                  ? {
                      title: '🖼️ 수업 교재 이미지',
                      body: summaryResult.imagesUsed.map((url, idx) => `이미지 ${idx + 1}: ${url}`).join('\n'),
                    }
                  : null,
                summaryResult.summary.encouragement
                  ? { title: '✨ 마무리 응원', body: resolveString(summaryResult.summary.encouragement) }
                  : null,
              ]
                .filter(Boolean)
                .map((card, idx) => (
                  <div key={idx} className={styles.cardItem}>
                    <div className={styles.cardTitle}>{card!.title}</div>
                    <div className={styles.cardBody}>
                      <MarkdownMath content={card!.body} />
                    </div>
                    <div className={styles.cardHint}>좌우로 넘겨서 보기 →</div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          )}

          {viewMode === 'full' && (
            <>
          {summaryResult.summary.teacherMessage && (
            <div className={`${styles.panel} ${styles.panelYellow}`}>
              <h4 className={styles.panelTitle}>💬 쌤의 한마디</h4>
              <MarkdownMath content={resolveString(summaryResult.summary.teacherMessage)} />
            </div>
          )}

          {(summaryResult.summary.detailedContent || summaryResult.summary.conceptSummary) && (
            <div className={`${styles.panel} ${styles.panelGreen}`}>
              <h4 className={styles.panelTitle}>📖 오늘 수업 핵심 정리</h4>
              <MarkdownMath
                content={resolveString(
                  summaryResult.summary.detailedContent ||
                    normalizeConceptSummary(resolveString(summaryResult.summary.conceptSummary || ''))
                )}
              />
            </div>
          )}

          {summaryResult.summary.textbookHighlight && (
            <div className={`${styles.panel} ${styles.panelPurple}`}>
              <h4 className={styles.panelTitle}>📖 쌤 Tip</h4>
              <MarkdownMath content={resolveString(summaryResult.summary.textbookHighlight)} />
            </div>
          )}

          {summaryResult.imagesUsed && summaryResult.imagesUsed.length > 0 && (
            <div className={`${styles.panel} ${styles.panelBlue}`}>
              <h4 className={styles.panelTitle}>🖼️ 수업 교재 이미지</h4>
              <div className={styles.imageGrid}>
                {summaryResult.imagesUsed.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.imageItem}
                  >
                    <img src={url} alt={`교재 이미지 ${idx + 1}`} />
                    <span>이미지 {idx + 1} 보기</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {summaryResult.summary.missedParts && summaryResult.summary.missedParts.length > 0 && (
            <div className={`${styles.panel} ${styles.panelPink}`}>
              <h4 className={styles.panelTitle}>❓ 학생 질문 정리</h4>
              {summaryResult.summary.missedParts.map((part, idx) => (
                <div key={idx} className={styles.problemCard}>
                  <div className={styles.problemText}>
                    <strong>질문:</strong> {part.question}
                  </div>
                  {part.contextMeaning && (
                    <div className={styles.problemText}>
                      <strong>문맥:</strong> {part.contextMeaning}
                    </div>
                  )}
                  {part.whatNotUnderstood && (
                    <div className={styles.problemText}>
                      <strong>모르던 부분:</strong> {part.whatNotUnderstood}
                    </div>
                  )}
                  {part.whatToKnow && (
                    <div className={styles.problemText}>
                      <strong>알아야 할 것:</strong> {part.whatToKnow}
                    </div>
                  )}
                  {part.explanation && (
                    <div className={styles.problemText}>
                      <strong>설명:</strong> {part.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {summaryResult.summary.todayMission && false}

          {summaryResult.summary.encouragement && (
            <div className={`${styles.panel} ${styles.panelGray}`}>
              <MarkdownMath content={resolveString(summaryResult.summary.encouragement)} />
            </div>
          )}

          <div className={styles.inlineRow}>
            <button className={styles.primaryBtn} onClick={handleCompleteAndGoHomework}>
              ✅ 복습 완료, 랑쌤과 숙제할래?
            </button>
          </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
