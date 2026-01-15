'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownMath from '../components/MarkdownMath';
import styles from './page.module.css';

type SummaryResult = {
  reviewProgramId?: string;
  studentId?: string;
  studentName?: string;
  summary?: {
    title?: string;
    teacherMessage?: string;
    unitTitle?: string;
    conceptSummary?: string;
    detailedContent?: string;
    textbookHighlight?: string;
    missedParts?: Array<{
      question?: string;
      studentResponse?: string;
      correctAnswer?: string;
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

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);

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
        body: JSON.stringify({ roomId: roomId.trim() }),
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
        </section>
      )}
    </div>
  );
}
