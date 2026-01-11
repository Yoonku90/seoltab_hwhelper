'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface AssignmentListItem {
  _id: string;
  title: string;
  dueAt: string;
  progress: {
    total: number;
    solved: number;
    stuck: number;
    question: number;
    not_started?: number;
  };
  lastActivityAt?: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState('student1'); // 임시
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments?studentId=${studentId}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (error) {
      console.error('과제 리스트 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getProgressPercent = (assignment: AssignmentListItem) => {
    if (assignment.progress.total === 0) return 0;
    return Math.round((assignment.progress.solved / assignment.progress.total) * 100);
  };

  const createTestData = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/seed');
      const data = await res.json();
      if (data.success) {
        alert('테스트 데이터가 생성되었습니다!');
        fetchAssignments();
      } else {
        alert(data.message || '테스트 데이터 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('테스트 데이터 생성 오류:', error);
      alert('테스트 데이터 생성 중 오류가 발생했습니다.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className={styles.container}>로딩 중...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>숙제 관리</h1>
        <div className={styles.studentId}>
          학생 ID:{' '}
          <input
            type="text"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={styles.input}
          />
        </div>
      </header>

      <div className={styles.assignments}>
        {assignments.length === 0 ? (
          <div className={styles.empty}>
            <p>과제가 없습니다.</p>
            <button
              onClick={createTestData}
              disabled={creating}
              className={styles.createBtn}
            >
              {creating ? '생성 중...' : '테스트 데이터 생성하기'}
            </button>
            <p className={styles.hint}>
              테스트 데이터를 생성하면 샘플 과제와 문제가 자동으로 만들어집니다.
            </p>
          </div>
        ) : (
          assignments.map((assignment) => (
            <Link
              key={assignment._id}
              href={`/assignments/${assignment._id}`}
              className={styles.card}
            >
              <h2>{assignment.title}</h2>
              <div className={styles.meta}>
                <span>마감: {formatDate(assignment.dueAt)}</span>
                {assignment.lastActivityAt && (
                  <span>마지막 활동: {formatDate(assignment.lastActivityAt)}</span>
                )}
              </div>
              <div className={styles.progress}>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${getProgressPercent(assignment)}%` }}
                  />
                </div>
                <div className={styles.progressText}>
                  진행률: {getProgressPercent(assignment)}% ({assignment.progress.solved}/
                  {assignment.progress.total})
                </div>
                <div className={styles.status}>
                  <span className={styles.solved}>풀었어요: {assignment.progress.solved}</span>
                  <span className={styles.stuck}>막혔어요: {assignment.progress.stuck}</span>
                  <span className={styles.question}>질문할래요: {assignment.progress.question}</span>
                </div>
              </div>
              <button className={styles.continueBtn}>계속하기</button>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}


