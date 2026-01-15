'use client';

import Link from 'next/link';
import styles from './page.module.css';

export default function AdminDashboard() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🐰🐶 관리자 (POC)</h1>
        <p className={styles.subtitle}>필수 기능만 남긴 데모 메뉴</p>
      </header>

      <section className={styles.menuGrid}>
        <Link href="/admin/lecture-summary" className={styles.menuCard}>
          <div className={styles.menuIcon}>✨</div>
          <div className={styles.menuTitle}>요약본 생성/보기</div>
          <div className={styles.menuDesc}>Room ID로 요약본 확인, 학습 완료 버튼</div>
        </Link>

        <Link href="/admin/summaries" className={styles.menuCard}>
          <div className={styles.menuIcon}>📋</div>
          <div className={styles.menuTitle}>요약본 목록</div>
          <div className={styles.menuDesc}>생성된 요약본 리스트 확인</div>
        </Link>

        <Link href="/admin/lecture" className={styles.menuCard}>
          <div className={styles.menuIcon}>🎤</div>
          <div className={styles.menuTitle}>수업 STT</div>
          <div className={styles.menuDesc}>Room ID로 STT만 확인</div>
        </Link>

        <Link href="/admin/room-images" className={styles.menuCard}>
          <div className={styles.menuIcon}>🖼️</div>
          <div className={styles.menuTitle}>이미지</div>
          <div className={styles.menuDesc}>Room ID 이미지 확인</div>
        </Link>

        <Link href="/homework" className={styles.menuCard}>
          <div className={styles.menuIcon}>📝</div>
          <div className={styles.menuTitle}>숙제 페이지</div>
          <div className={styles.menuDesc}>숙제 페이지만 테스트</div>
        </Link>
      </section>
    </div>
  );
}

