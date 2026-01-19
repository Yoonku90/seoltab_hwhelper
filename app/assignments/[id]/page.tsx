'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { ProblemStatus } from '@/lib/types';

interface Problem {
  _id: string;
  problemNumber: number;
  problemText?: string;
  imageUrl?: string;
  latestAttempt: {
    status: ProblemStatus;
    updatedAt: string;
    timeSpent?: number;
  };
}

interface Assignment {
  _id: string;
  title: string;
  description?: string;
  dueAt: string;
  progress: {
    total: number;
    solved: number;
    stuck: number;
    question: number;
    not_started?: number;
  };
  top5Confirmed: boolean;
}

export default function AssignmentSession() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id as string;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('student1'); // 임시
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [hintStep, setHintStep] = useState<number | null>(null);
  const [hintData, setHintData] = useState<{
    hintTitle: string;
    hintText: string;
    nextAction?: string;
  } | null>(null);
  const [loadingHint, setLoadingHint] = useState(false);

  useEffect(() => {
    fetchSession();
  }, [assignmentId]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/session`);
      const data = await res.json();
      setAssignment(data.assignment);
      setProblems(data.problems || []);
    } catch (error) {
      console.error('세션 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (problemId: string, status: ProblemStatus) => {
    try {
      await fetch(`/api/problems/${problemId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, studentId }),
      });
      fetchSession();
    } catch (error) {
      console.error('상태 업데이트 오류:', error);
      alert('상태 업데이트에 실패했습니다.');
    }
  };

  const getHelp = async (problemId: string, step: number) => {
    setLoadingHint(true);
    setSelectedProblem(problemId);
    setHintStep(step);
    try {
      const res = await fetch(`/api/problems/${problemId}/help?step=${step}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      setHintData({
        hintTitle: data.hintTitle,
        hintText: data.hintText,
        nextAction: data.nextAction,
      });
    } catch (error) {
      console.error('힌트 조회 오류:', error);
      alert('힌트를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingHint(false);
    }
  };

  const getStatusColor = (status: ProblemStatus) => {
    switch (status) {
      case 'solved':
        return '#4caf50';
      case 'stuck':
        return '#ff9800';
      case 'question':
        return '#2196f3';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: ProblemStatus) => {
    switch (status) {
      case 'solved':
        return '풀었어요';
      case 'stuck':
        return '막혔어요';
      case 'question':
        return '질문할래요';
      default:
        return '미정';
    }
  };

  if (loading) {
    return <div className={styles.container}>로딩 중...</div>;
  }

  if (!assignment) {
    return <div className={styles.container}>과제를 찾을 수 없습니다.</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/" className={styles.backBtn}>
          ← 돌아가기
        </Link>
        <h1>{assignment.title}</h1>
        <div className={styles.progress}>
          진행률: {assignment.progress.solved}/{assignment.progress.total} (
          {assignment.progress.total > 0
            ? Math.round((assignment.progress.solved / assignment.progress.total) * 100)
            : 0}
          %)
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.problems}>
          <h2>문제 리스트</h2>
          {problems.length === 0 ? (
            <div className={styles.empty}>문제가 없습니다.</div>
          ) : (
            <div className={styles.problemList}>
              {problems.map((problem) => (
                <div key={problem._id} className={styles.problemCard}>
                  <div className={styles.problemHeader}>
                    <h3>문제 {problem.problemNumber}</h3>
                    <span
                      className={styles.statusBadge}
                      style={{ backgroundColor: getStatusColor(problem.latestAttempt.status) }}
                    >
                      {getStatusText(problem.latestAttempt.status)}
                    </span>
                  </div>
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
                  <div className={styles.actions}>
                    <button
                      className={`${styles.statusBtn} ${problem.latestAttempt.status === 'solved' ? styles.active : ''}`}
                      onClick={() => updateStatus(problem._id, 'solved')}
                    >
                      풀었어요
                    </button>
                    <button
                      className={`${styles.statusBtn} ${problem.latestAttempt.status === 'stuck' ? styles.active : ''}`}
                      onClick={() => updateStatus(problem._id, 'stuck')}
                    >
                      막혔어요
                    </button>
                    <button
                      className={`${styles.statusBtn} ${problem.latestAttempt.status === 'question' ? styles.active : ''}`}
                      onClick={() => updateStatus(problem._id, 'question')}
                    >
                      질문할래요
                    </button>
                      <button
                        className={styles.helpBtn}
                        onClick={() => getHelp(problem._id, 1)}
                        disabled={loadingHint}
                      >
                      힌트 받기
                      </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedProblem && (
          <div className={styles.hintPanel}>
            <h2>AI 도움</h2>
            {loadingHint ? (
              <div>힌트를 생성하는 중...</div>
            ) : hintData ? (
              <div className={styles.hintContent}>
                <h3>{hintData.hintTitle}</h3>
                <div className={styles.hintText}>{hintData.hintText}</div>
                {hintData.nextAction && (
                  <div className={styles.nextAction}>{hintData.nextAction}</div>
                )}
                {hintStep && hintStep < 4 && (
                  <button
                    className={styles.nextStepBtn}
                    onClick={() => getHelp(selectedProblem, hintStep + 1)}
                  >
                    다음 단계 ({hintStep + 1}단계)
                  </button>
                )}
              </div>
            ) : (
              <div>힌트를 불러오는 중...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

