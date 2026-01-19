'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import styles from './page.module.css';

interface DashboardItem {
  assignmentId: string;
  title: string;
  studentId: string;
  dueAt: string;
  progress: {
    total: number;
    solved: number;
    stuck: number;
    question: number;
    not_started?: number;
  };
  lastActivityAt?: string;
  top5Confirmed: boolean;
  top5ConfirmedAt?: string;
  digest: {
    top5Problems: Array<{
      problemId: string;
      problemNumber: number;
      problemText?: string;
      imageUrl?: string;
      stuckReason?: string;
      timeSpent?: number;
    }>;
    summary: {
      totalProblems: number;
      solved: number;
      stuck: number;
      question: number;
      commonStuckReasons: string[];
      averageTimeSpent?: number;
    };
    generatedAt: string;
  } | null;
}

export default function TeacherDashboard() {
  const params = useParams();
  const teacherId = params.id as string;

  const [dashboard, setDashboard] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, [teacherId]);

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/teachers/${teacherId}/dashboard`);
      const data = await res.json();
      setDashboard(data.dashboard || []);
    } catch (error) {
      console.error('대시보드 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateDigest = async (assignmentId: string) => {
    try {
      await fetch(`/api/assignments/${assignmentId}/digest/generate`, {
        method: 'POST',
      });
      fetchDashboard();
      alert('Digest가 생성되었습니다.');
    } catch (error) {
      console.error('Digest 생성 오류:', error);
      alert('Digest 생성에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}분 ${secs}초`;
  };

  if (loading) {
    return <div className={styles.container}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>선생님 대시보드</h1>
        <p>선생님 ID: {teacherId}</p>
      </header>

      <div className={styles.dashboard}>
        {dashboard.length === 0 ? (
          <div className={styles.empty}>과제가 없습니다.</div>
        ) : (
          dashboard.map((item) => (
            <div key={item.assignmentId} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{item.title}</h2>
                <div className={styles.meta}>
                  <span>학생 ID: {item.studentId}</span>
                  <span>마감: {formatDate(item.dueAt)}</span>
                  {item.lastActivityAt && (
                    <span>마지막 활동: {formatDate(item.lastActivityAt)}</span>
                  )}
                </div>
              </div>

              <div className={styles.progress}>
                <div className={styles.progressStats}>
                  <div className={styles.stat}>
                    <span className={styles.label}>전체</span>
                    <span className={styles.value}>{item.progress.total}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>풀었어요</span>
                    <span className={`${styles.value} ${styles.solved}`}>
                      {item.progress.solved}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>막혔어요</span>
                    <span className={`${styles.value} ${styles.stuck}`}>
                      {item.progress.stuck}
                    </span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>질문할래요</span>
                    <span className={`${styles.value} ${styles.question}`}>
                      {item.progress.question}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.top5Status}>
                {item.top5Confirmed ? (
                  <div className={styles.confirmed}>
                    ✓ Top5 확정됨 ({item.top5ConfirmedAt && formatDate(item.top5ConfirmedAt)})
                  </div>
                ) : (
                  <div className={styles.notConfirmed}>Top5 미확정</div>
                )}
              </div>

              <div className={styles.actions}>
                {!item.digest && (
                  <button
                    className={styles.generateBtn}
                    onClick={() => generateDigest(item.assignmentId)}
                  >
                    Digest 생성
                  </button>
                )}
                <button
                  className={styles.toggleBtn}
                  onClick={() =>
                    setSelectedAssignment(
                      selectedAssignment === item.assignmentId
                        ? null
                        : item.assignmentId
                    )
                  }
                >
                  {selectedAssignment === item.assignmentId
                    ? '접기'
                    : '상세 보기'}
                </button>
              </div>

              {selectedAssignment === item.assignmentId && item.digest && (
                <div className={styles.digest}>
                  <h3>Top5 문제</h3>
                  <div className={styles.top5List}>
                    {item.digest.top5Problems.map((problem, idx) => (
                      <div key={problem.problemId} className={styles.top5Item}>
                        <div className={styles.top5Header}>
                          <span className={styles.top5Number}>
                            {idx + 1}. 문제 {problem.problemNumber}
                          </span>
                          {problem.timeSpent && (
                            <span className={styles.timeSpent}>
                              소요시간: {formatTime(problem.timeSpent)}
                            </span>
                          )}
                        </div>
                        {problem.problemText && (
                          <p className={styles.top5Text}>{problem.problemText}</p>
                        )}
                        {problem.stuckReason && (
                          <div className={styles.stuckReason}>
                            막힘 이유: {problem.stuckReason}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <h3>요약</h3>
                  <div className={styles.summary}>
                    <div className={styles.summaryItem}>
                      <span>평균 소요시간:</span>
                      <span>
                        {formatTime(item.digest.summary.averageTimeSpent)}
                      </span>
                    </div>
                    {item.digest.summary.commonStuckReasons.length > 0 && (
                      <div className={styles.summaryItem}>
                        <span>주요 막힘 이유:</span>
                        <ul>
                          {item.digest.summary.commonStuckReasons.map(
                            (reason, idx) => (
                              <li key={idx}>{reason}</li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

