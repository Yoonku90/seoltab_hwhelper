'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>관리자 페이지로 이동 중...</h1>
        <p className={styles.subtitle}>/home 으로 이동합니다.</p>
      </header>
    </div>
  );
}

