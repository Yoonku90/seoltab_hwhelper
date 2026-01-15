'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import MarkdownMath from '@/app/components/MarkdownMath';
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

export default function LectureSummaryPage() {
  const router = useRouter();
  const cardScrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'full' | 'cards'>('full');

  const handleGenerateSummary = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
        body: JSON.stringify({ roomId: roomId.trim() }),
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

              <div className={styles.summaryHeader}>
                <h4>{summaryResult.summary?.title || '[유은서 쌤이 방금 만든 따끈따끈한 비법 노트!]'}</h4>
                {summaryResult.reviewProgramId && (
                  <p className={styles.summaryLink}>
                    <a 
                      href={`/review-programs/${summaryResult.reviewProgramId}`}
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
                    summaryResult.summary?.teacherMessage
                      ? { title: '💬 쌤의 한마디', body: resolveString(summaryResult.summary.teacherMessage) }
                      : null,
                    ...(summaryResult.summary?.detailedContent || summaryResult.summary?.conceptSummary
                      ? splitNumberedSections(
                          resolveString(
                            summaryResult.summary?.detailedContent ||
                              normalizeConceptSummary(resolveString(summaryResult.summary?.conceptSummary || ''))
                          )
                        ).map((section, idx) => ({
                          title: `📖 오늘 수업 핵심 정리 ${idx + 1}`,
                          body: section,
                        }))
                      : []),
                    summaryResult.summary?.textbookHighlight
                      ? { title: '📖 쌤 Tip', body: resolveString(summaryResult.summary.textbookHighlight) }
                      : null,
                    summaryResult.summary?.missedParts && summaryResult.summary.missedParts.length > 0
                      ? {
                          title: '❓ 학생 질문 정리',
                          body: summaryResult.summary.missedParts
                            .map((part: any) => {
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
                          body: summaryResult.imagesUsed.map((url: string, idx: number) => `이미지 ${idx + 1}: ${url}`).join('\n'),
                        }
                      : null,
                    summaryResult.summary?.encouragement
                      ? { title: '✨ 마무리 응원', body: summaryResult.summary.encouragement }
                      : null,
                  ]
                    .filter(Boolean)
                    .map((card: any, idx: number) => (
                      <div key={idx} className={styles.cardItem}>
                        <div className={styles.cardTitle}>{card.title}</div>
                        <div className={styles.cardBody}>
                          <MarkdownMath content={card.body} />
                        </div>
                        <div className={styles.cardHint}>좌우로 넘겨서 보기 →</div>
                      </div>
                    ))}
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
                      href={`/review-programs/${summaryResult.reviewProgramId}`}
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
                      const res = await fetch(`/api/review-programs/${summaryResult.reviewProgramId}`, {
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

