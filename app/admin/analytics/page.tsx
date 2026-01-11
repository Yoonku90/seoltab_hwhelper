'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface AnalyticsData {
  totalStudents: number;
  totalSessions: number;
  totalReviewPrograms: number;
  subjectDistribution: Record<string, number>;
  gradeDistribution: Record<string, number>;
  recentActivity: Array<{
    studentId: string;
    studentName?: string;
    action: string;
    subject?: string;
    timestamp: string;
  }>;
  topTopics: Array<{ topic: string; count: number }>;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics');
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('분석 데이터 로드 실패:', error);
    } finally {
      setLoading(false);
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
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>📊 학습 분석</h1>
      </header>

      {/* 요약 카드 */}
      <section className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{data?.totalStudents || 0}</div>
          <div className={styles.summaryLabel}>전체 학생</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{data?.totalReviewPrograms || 0}</div>
          <div className={styles.summaryLabel}>복습 세션</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{data?.totalSessions || 0}</div>
          <div className={styles.summaryLabel}>총 학습 횟수</div>
        </div>
      </section>

      <div className={styles.chartsGrid}>
        {/* 과목별 분포 */}
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}>📚 과목별 학습</h2>
          <div className={styles.barChart}>
            {Object.entries(data?.subjectDistribution || {}).map(([subject, count]) => (
              <div key={subject} className={styles.barItem}>
                <div className={styles.barLabel}>{subject}</div>
                <div className={styles.barWrapper}>
                  <div 
                    className={styles.barFill}
                    style={{ 
                      width: `${Math.min(100, (count / Math.max(...Object.values(data?.subjectDistribution || {}))) * 100)}%` 
                    }}
                  />
                </div>
                <div className={styles.barValue}>{count}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 학년별 분포 */}
        <section className={styles.chartCard}>
          <h2 className={styles.chartTitle}>🎓 학년별 분포</h2>
          <div className={styles.barChart}>
            {Object.entries(data?.gradeDistribution || {}).map(([grade, count]) => (
              <div key={grade} className={styles.barItem}>
                <div className={styles.barLabel}>{grade}</div>
                <div className={styles.barWrapper}>
                  <div 
                    className={styles.barFill}
                    style={{ 
                      width: `${Math.min(100, (count / Math.max(...Object.values(data?.gradeDistribution || {}))) * 100)}%` 
                    }}
                  />
                </div>
                <div className={styles.barValue}>{count}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 인기 주제 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🔥 인기 학습 주제</h2>
        <div className={styles.topicList}>
          {(data?.topTopics || []).slice(0, 10).map((item, idx) => (
            <div key={item.topic} className={styles.topicItem}>
              <span className={styles.topicRank}>#{idx + 1}</span>
              <span className={styles.topicName}>{item.topic}</span>
              <span className={styles.topicCount}>{item.count}회</span>
            </div>
          ))}
        </div>
      </section>

      {/* 최근 활동 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🕐 최근 활동</h2>
        <div className={styles.activityList}>
          {(data?.recentActivity || []).slice(0, 20).map((activity, idx) => (
            <div key={idx} className={styles.activityItem}>
              <div className={styles.activityInfo}>
                <span className={styles.activityStudent}>
                  {activity.studentName || activity.studentId}
                </span>
                <span className={styles.activityAction}>{activity.action}</span>
                {activity.subject && (
                  <span className={styles.activitySubject}>{activity.subject}</span>
                )}
              </div>
              <div className={styles.activityTime}>
                {new Date(activity.timestamp).toLocaleString('ko-KR')}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

