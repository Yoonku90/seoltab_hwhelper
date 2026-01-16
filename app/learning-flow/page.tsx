'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MarkdownMath from '@/app/components/MarkdownMath';
import styles from './page.module.css';

type LearningPhase = 'summary' | 'review' | 'homework' | 'complete';

// 학습 통계 컴포넌트
function StatsSection({ studentId }: { studentId: string }) {
  const [stats, setStats] = useState({
    completedSummaries: 0,
    reviewTime: 0,
    solvedProblems: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        // 완료한 요약본 수
        const summariesRes = await fetch(`/api/review-programs?studentId=${studentId}`);
        const summariesData = await summariesRes.json();
        const completedSummaries = summariesData.reviewPrograms?.filter((rp: any) => 
          rp.metadata?.isSecretNote
        ).length || 0;

        // 학습 세션에서 복습 시간 집계 (추후 구현)
        // 숙제에서 풀은 문제 수 집계 (추후 구현)

        setStats({
          completedSummaries,
          reviewTime: 0, // TODO: 학습 세션에서 집계
          solvedProblems: 0, // TODO: 숙제 세션에서 집계
        });
      } catch (e) {
        console.error('통계 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [studentId]);

  if (loading) {
    return (
      <section className={styles.statsSection}>
        <h3>📊 오늘의 학습 현황</h3>
        <div className={styles.loading}>로딩 중...</div>
      </section>
    );
  }

  return (
    <section className={styles.statsSection}>
      <h3>📊 오늘의 학습 현황</h3>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.completedSummaries}</div>
          <div className={styles.statLabel}>완료한 요약본</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.reviewTime}분</div>
          <div className={styles.statLabel}>복습 시간</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.solvedProblems}</div>
          <div className={styles.statLabel}>풀은 문제</div>
        </div>
      </div>
    </section>
  );
}

type ReviewProgram = {
  _id: string;
  title: string;
  subject: string;
  createdAt: Date;
  reviewContent?: any;
  metadata?: {
    roomId?: string;
    isSecretNote?: boolean;
  };
};

export default function LearningFlowPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get('studentId') || 'unknown';
  
  const [currentPhase, setCurrentPhase] = useState<LearningPhase>('summary');
  const [recentSummary, setRecentSummary] = useState<ReviewProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState('');

  // 학생 이름 불러오기
  useEffect(() => {
    const loadStudentName = async () => {
      if (studentId === 'unknown') return;
      try {
        const res = await fetch(`/api/students?studentId=${studentId}`);
        const data = await res.json();
        if (data.exists && data.student) {
          setStudentName(data.student.name);
        }
      } catch (e) {
        console.error('학생 이름 로드 실패:', e);
      }
    };
    loadStudentName();
  }, [studentId]);

  // 최근 요약본 불러오기
  useEffect(() => {
    const loadRecentSummary = async () => {
      try {
        // 최근 시크릿 노트 찾기
        const res = await fetch(`/api/review-programs?studentId=${studentId}`);
        const data = await res.json();
        if (data.reviewPrograms && data.reviewPrograms.length > 0) {
          // 시크릿 노트만 필터링하고 최신순 정렬
          const secretNotes = data.reviewPrograms
            .filter((rp: any) => rp.metadata?.isSecretNote)
            .sort((a: any, b: any) => {
              const aDate = new Date(a.createdAt || 0).getTime();
              const bDate = new Date(b.createdAt || 0).getTime();
              return bDate - aDate;
            });
          
          if (secretNotes.length > 0) {
            setRecentSummary(secretNotes[0]);
            setCurrentPhase('review');
          }
        }
      } catch (e) {
        console.error('최근 요약본 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    };
    loadRecentSummary();
  }, [studentId]);

  const handleCompleteReview = async () => {
    if (!recentSummary) return;
    
    try {
      // 학습 완료 기록
      await fetch(`/api/learning/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          reviewProgramId: recentSummary._id,
          roomId: recentSummary.metadata?.roomId,
        }),
      });

      // 숙제 페이지로 이동
      router.push(`/homework?studentId=${studentId}&tutor=rangsam&fromReview=true`);
    } catch (err) {
      console.error('학습 완료 기록 실패:', err);
      // 실패해도 이동
      router.push(`/homework?studentId=${studentId}&tutor=rangsam`);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          {studentName ? `${studentName}의 학습 플로우` : '나의 학습 플로우'}
        </h1>
        <p className={styles.subtitle}>
          수업 직후부터 숙제까지, 완벽한 학습 여정을 함께해요! 🚀
        </p>
      </header>

      {/* 학습 단계 표시 */}
      <div className={styles.phaseIndicator}>
        <div className={`${styles.phase} ${currentPhase === 'summary' ? styles.active : ''}`}>
          <div className={styles.phaseNumber}>1</div>
          <div className={styles.phaseLabel}>요약본</div>
        </div>
        <div className={styles.phaseConnector}></div>
        <div className={`${styles.phase} ${currentPhase === 'review' ? styles.active : ''}`}>
          <div className={styles.phaseNumber}>2</div>
          <div className={styles.phaseLabel}>복습</div>
        </div>
        <div className={styles.phaseConnector}></div>
        <div className={`${styles.phase} ${currentPhase === 'homework' ? styles.active : ''}`}>
          <div className={styles.phaseNumber}>3</div>
          <div className={styles.phaseLabel}>숙제</div>
        </div>
      </div>

      {/* Phase 1: 요약본 생성 */}
      {currentPhase === 'summary' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>📝 Step 1: 따끈따끈 요약본 만들기</h2>
            <p className={styles.sectionDesc}>
              수업이 끝났다면, Room ID로 요약본을 만들어보세요!
            </p>
          </div>
          
          <div className={styles.actionCard}>
            <div className={styles.actionIcon}>✨</div>
            <div className={styles.actionContent}>
              <h3>유은서 쌤의 비법 노트 생성</h3>
              <p>STT와 교재 이미지를 결합하여 10분 요약본을 만들어요.</p>
              <Link href="/admin/lecture-summary" className={styles.actionButton}>
                요약본 만들기 →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Phase 2: 복습 */}
      {currentPhase === 'review' && recentSummary && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>📚 Step 2: 복습하기</h2>
            <p className={styles.sectionDesc}>
              요약본을 보면서 튜터와 대화하며 복습해요.
            </p>
          </div>

          <div className={styles.summaryPreview}>
            <h3>{recentSummary.title}</h3>
            <div className={styles.summaryMeta}>
              <span>과목: {recentSummary.subject}</span>
              <span>생성일: {new Date(recentSummary.createdAt).toLocaleDateString('ko-KR')}</span>
            </div>
            
            {recentSummary.reviewContent?.teacherMessage && (
              <div className={styles.previewContent}>
                <strong>💬 쌤의 한마디:</strong>
                <MarkdownMath content={recentSummary.reviewContent.teacherMessage.substring(0, 100) + '...'} />
              </div>
            )}
          </div>

          <div className={styles.actionButtons}>
            <Link 
              href={`/admin/lecture-summary?reviewProgramId=${recentSummary._id}`}
              className={styles.primaryButton}
            >
              복습 시작하기 →
            </Link>
            <button
              onClick={handleCompleteReview}
              className={styles.completeButton}
            >
              ✅ 복습 완료 → 숙제하러 가기
            </button>
          </div>
        </section>
      )}

      {/* Phase 3: 숙제 */}
      {currentPhase === 'homework' && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>📝 Step 3: 숙제하기</h2>
            <p className={styles.sectionDesc}>
              이제 배운 내용을 문제에 적용해봐요!
            </p>
          </div>

          <div className={styles.actionCard}>
            <div className={styles.actionIcon}>📚</div>
            <div className={styles.actionContent}>
              <h3>은서쌤과 숙제하자!</h3>
              <p>문제집이나 시험지를 찍어서 올리면 랑쌤/준쌤이 도와줘요.</p>
              <Link 
                href={`/homework?studentId=${studentId}&tutor=rangsam`}
                className={styles.actionButton}
              >
                숙제 시작하기 →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 학습 통계 */}
      <StatsSection studentId={studentId} />
    </div>
  );
}

