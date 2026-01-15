'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface DashboardStats {
  students: number;
  reviewPrograms: number;
  imageUploads: number;
  accessTokens: number;
  storageUsed?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('통계 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🐰🐶 랑쌤/준쌤 관리자 페이지</h1>
        <p className={styles.subtitle}>Students Helper Admin Dashboard</p>
      </header>

      {/* 통계 카드 */}
      <section className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>👨‍🎓</div>
          <div className={styles.statValue}>{loading ? '...' : stats?.students || 0}</div>
          <div className={styles.statLabel}>학생 수</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📚</div>
          <div className={styles.statValue}>{loading ? '...' : stats?.reviewPrograms || 0}</div>
          <div className={styles.statLabel}>복습 프로그램</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🖼️</div>
          <div className={styles.statValue}>{loading ? '...' : stats?.imageUploads || 0}</div>
          <div className={styles.statLabel}>이미지 업로드</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🔑</div>
          <div className={styles.statValue}>{loading ? '...' : stats?.accessTokens || 0}</div>
          <div className={styles.statLabel}>활성 토큰</div>
        </div>
      </section>

      {/* 메뉴 카드 */}
      <section className={styles.menuGrid}>
        <Link href="/admin/students" className={styles.menuCard}>
          <div className={styles.menuIcon}>👨‍🎓</div>
          <div className={styles.menuTitle}>학생 관리</div>
          <div className={styles.menuDesc}>학생 목록, 학습 현황, 프로필 관리</div>
        </Link>

        <Link href="/admin/tokens" className={styles.menuCard}>
          <div className={styles.menuIcon}>🔗</div>
          <div className={styles.menuTitle}>토큰 관리</div>
          <div className={styles.menuDesc}>학생 접속 링크 생성 및 관리</div>
        </Link>

        <Link href="/admin/data" className={styles.menuCard}>
          <div className={styles.menuIcon}>🗄️</div>
          <div className={styles.menuTitle}>데이터 관리</div>
          <div className={styles.menuDesc}>MongoDB, Supabase Storage 관리</div>
        </Link>

        <Link href="/admin/analytics" className={styles.menuCard}>
          <div className={styles.menuIcon}>📊</div>
          <div className={styles.menuTitle}>학습 분석</div>
          <div className={styles.menuDesc}>학습 통계, 진도율, 성취도</div>
        </Link>

        <Link href="/admin/lecture" className={styles.menuCard}>
          <div className={styles.menuIcon}>🎤</div>
          <div className={styles.menuTitle}>수업 STT 검색</div>
          <div className={styles.menuDesc}>LVT, Room ID, 또는 User ID로 수업 STT 데이터 검색</div>
        </Link>

        <Link href="/admin/lecture-summary" className={styles.menuCard}>
          <div className={styles.menuIcon}>✨</div>
          <div className={styles.menuTitle}>따끈따끈 요약본 생성</div>
          <div className={styles.menuDesc}>Room ID로 STT와 교재 이미지를 결합하여 10분 컷 요약본 생성</div>
        </Link>

        <Link href="/admin/summaries" className={styles.menuCard}>
          <div className={styles.menuIcon}>📋</div>
          <div className={styles.menuTitle}>요약본 목록</div>
          <div className={styles.menuDesc}>생성된 모든 요약본을 확인하고 관리</div>
        </Link>

        <Link href="/admin/room-images" className={styles.menuCard}>
          <div className={styles.menuIcon}>🖼️</div>
          <div className={styles.menuTitle}>룸아이디 이미지 검색</div>
          <div className={styles.menuDesc}>Pagecall 룸아이디로 해당 룸의 모든 이미지 확인</div>
        </Link>
      </section>

      {/* 빠른 작업 */}
      <section className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>⚡ 빠른 작업</h2>
        <div className={styles.actionButtons}>
          <button 
            className={styles.actionBtn}
            onClick={() => window.location.href = '/admin/tokens'}
          >
            🔗 새 학생 링크 생성
          </button>
          <button 
            className={`${styles.actionBtn} ${styles.danger}`}
            onClick={async () => {
              if (confirm('정말 모든 테스트 데이터를 삭제할까요?')) {
                const res = await fetch('/api/admin/clear-data', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }),
                });
                const data = await res.json();
                alert(data.message || '완료!');
                fetchStats();
              }
            }}
          >
            🗑️ 테스트 데이터 초기화
          </button>
        </div>
      </section>
    </div>
  );
}

