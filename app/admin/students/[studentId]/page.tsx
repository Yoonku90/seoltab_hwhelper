'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface StudentDetail {
  student: {
    _id: string;
    studentId: string;
    name: string;
    nickname?: string;
    grade: string;
    createdAt: string;
    updatedAt: string;
    agentMemory?: {
      totalSessions?: number;
      recentTopics?: string[];
      frequentStuckPoints?: string[];
      currentUnderstanding?: Record<string, number>;
      lastLessonSummary?: string;
    };
  };
  reviewPrograms: Array<{
    _id: string;
    title: string;
    subject: string;
    createdAt: string;
    progress?: {
      stage: string;
      idx: number;
    };
  }>;
  imageUploads: Array<{
    _id: string;
    fileName: string;
    uploadedAt: string;
    analyzed: boolean;
  }>;
}

export default function StudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  
  const [data, setData] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (studentId) {
      fetchStudentDetail();
    }
  }, [studentId]);

  const fetchStudentDetail = async () => {
    try {
      const res = await fetch(`/api/admin/students/${studentId}`);
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('학생 상세 로드 실패:', error);
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

  if (!data?.student) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>학생을 찾을 수 없습니다.</div>
      </div>
    );
  }

  const { student, reviewPrograms, imageUploads } = data;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin/students" className={styles.backBtn}>← 목록으로</Link>
        <h1 className={styles.title}>
          {student.name || '이름 없음'}
          <span className={styles.gradeBadge}>{student.grade}</span>
        </h1>
      </header>

      {/* 기본 정보 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>👤 기본 정보</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Student ID</span>
            <span className={styles.infoValue}>{student.studentId}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>닉네임</span>
            <span className={styles.infoValue}>{student.nickname || '-'}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>가입일</span>
            <span className={styles.infoValue}>
              {new Date(student.createdAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>마지막 접속</span>
            <span className={styles.infoValue}>
              {new Date(student.updatedAt).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
      </section>

      {/* 학습 현황 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📊 학습 현황</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{student.agentMemory?.totalSessions || 0}</div>
            <div className={styles.statLabel}>총 세션</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{reviewPrograms.length}</div>
            <div className={styles.statLabel}>복습 프로그램</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{imageUploads.length}</div>
            <div className={styles.statLabel}>업로드 이미지</div>
          </div>
        </div>

        {/* 최근 학습 주제 */}
        {Array.isArray(student.agentMemory?.recentTopics) && student.agentMemory.recentTopics.length > 0 && (
          <div className={styles.topicsSection}>
            <h3 className={styles.subTitle}>📚 최근 학습 주제</h3>
            <div className={styles.topicTags}>
              {student.agentMemory.recentTopics.map((topic, idx) => (
                <span key={idx} className={styles.topicTag}>{topic}</span>
              ))}
            </div>
          </div>
        )}

        {/* 자주 막히는 부분 */}
        {Array.isArray(student.agentMemory?.frequentStuckPoints) && student.agentMemory.frequentStuckPoints.length > 0 && (
          <div className={styles.stuckSection}>
            <h3 className={styles.subTitle}>⚠️ 자주 막히는 부분</h3>
            <div className={styles.stuckList}>
              {student.agentMemory.frequentStuckPoints.map((point, idx) => (
                <div key={idx} className={styles.stuckItem}>{point}</div>
              ))}
            </div>
          </div>
        )}

        {/* 이해도 현황 */}
        {student.agentMemory?.currentUnderstanding && (
          <div className={styles.understandingSection}>
            <h3 className={styles.subTitle}>📈 이해도 현황</h3>
            <div className={styles.understandingGrid}>
              {Object.entries(student.agentMemory.currentUnderstanding).map(([topic, level]) => (
                <div key={topic} className={styles.understandingItem}>
                  <span className={styles.understandingTopic}>{topic}</span>
                  <div className={styles.understandingBar}>
                    <div 
                      className={styles.understandingFill}
                      style={{ width: `${(level as number) * 20}%` }}
                    />
                  </div>
                  <span className={styles.understandingValue}>{level}/5</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 복습 프로그램 목록 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📚 복습 프로그램</h2>
        {reviewPrograms.length === 0 ? (
          <div className={styles.empty}>아직 복습 기록이 없습니다.</div>
        ) : (
          <div className={styles.programList}>
            {reviewPrograms.map((rp) => (
              <div key={rp._id} className={styles.programItem}>
                <div className={styles.programInfo}>
                  <div className={styles.programTitle}>{rp.title}</div>
                  <div className={styles.programMeta}>
                    <span className={styles.programSubject}>{rp.subject}</span>
                    <span className={styles.programDate}>
                      {new Date(rp.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
                {rp.progress && (
                  <div className={styles.programProgress}>
                    {rp.progress.stage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

