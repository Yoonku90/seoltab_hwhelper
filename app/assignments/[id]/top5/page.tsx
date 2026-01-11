'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface Problem {
  _id: string;
  problemNumber: number;
  problemText?: string;
  imageUrl?: string;
  latestAttempt: {
    status: string;
    updatedAt: string;
    timeSpent?: number;
  };
}

export default function Top5Confirm() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedProblems, setSelectedProblems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentId, setStudentId] = useState('student1'); // 임시

  useEffect(() => {
    fetchSession();
  }, [assignmentId]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/session`);
      const data = await res.json();
      // 질문할 문제만 필터링 (또는 모든 문제 중 선택 가능하게)
      setProblems(data.problems || []);
    } catch (error) {
      console.error('세션 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleProblem = (problemId: string) => {
    const newSelected = new Set(selectedProblems);
    if (newSelected.has(problemId)) {
      newSelected.delete(problemId);
    } else {
      if (newSelected.size >= 5) {
        alert('최대 5개까지만 선택할 수 있습니다.');
        return;
      }
      newSelected.add(problemId);
    }
    setSelectedProblems(newSelected);
  };

  const confirmTop5 = async () => {
    if (selectedProblems.size === 0) {
      alert('최소 1개 이상 선택해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/top5/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemIds: Array.from(selectedProblems),
          studentId,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Top5 확정에 실패했습니다.');
      }

      alert('Top5가 확정되었습니다!');
      router.push(`/assignments/${assignmentId}`);
    } catch (error) {
      console.error('Top5 확정 오류:', error);
      alert(error instanceof Error ? error.message : 'Top5 확정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href={`/assignments/${assignmentId}`} className={styles.backBtn}>
          ← 돌아가기
        </Link>
        <h1>Top5 질문 확정</h1>
        <p>수업에서 다룰 최대 5개의 문제를 선택해주세요.</p>
      </header>

      <div className={styles.content}>
        <div className={styles.selectedCount}>
          선택된 문제: {selectedProblems.size} / 5
        </div>

        <div className={styles.problemList}>
          {problems.length === 0 ? (
            <div className={styles.empty}>문제가 없습니다.</div>
          ) : (
            problems.map((problem) => {
              const isSelected = selectedProblems.has(problem._id);
              return (
                <div
                  key={problem._id}
                  className={`${styles.problemCard} ${isSelected ? styles.selected : ''}`}
                  onClick={() => toggleProblem(problem._id)}
                >
                  <div className={styles.checkbox}>
                    {isSelected && <span className={styles.checkmark}>✓</span>}
                  </div>
                  <div className={styles.problemContent}>
                    <h3>문제 {problem.problemNumber}</h3>
                    {problem.problemText && (
                      <p className={styles.problemText}>{problem.problemText}</p>
                    )}
                    {problem.imageUrl && (
                      <img
                        src={problem.imageUrl}
                        alt={`문제 ${problem.problemNumber}`}
                        className={styles.problemImage}
                      />
                    )}
                    <div className={styles.meta}>
                      <span className={styles.status}>
                        상태: {problem.latestAttempt.status}
                      </span>
                      {problem.latestAttempt.timeSpent && (
                        <span className={styles.timeSpent}>
                          소요시간: {Math.floor(problem.latestAttempt.timeSpent / 60)}분
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.confirmBtn}
            onClick={confirmTop5}
            disabled={selectedProblems.size === 0 || submitting}
          >
            {submitting ? '확정 중...' : 'Top5 확정하기'}
          </button>
        </div>
      </div>
    </div>
  );
}

