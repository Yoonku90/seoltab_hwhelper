'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface CollectionInfo {
  name: string;
  count: number;
}

export default function AdminDataPage() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/clear-data');
      const data = await res.json();
      
      const cols: CollectionInfo[] = Object.entries(data.details || {}).map(([name, count]) => ({
        name,
        count: count as number,
      }));
      setCollections(cols.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCollection = async (collectionName: string) => {
    if (!confirm(`정말 '${collectionName}' 컬렉션의 모든 데이터를 삭제할까요?`)) return;
    
    setActionLoading(collectionName);
    try {
      const res = await fetch('/api/admin/clear-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionName, confirm: 'DELETE' }),
      });
      const data = await res.json();
      alert(data.message || '완료!');
      fetchData();
    } catch (error) {
      console.error('삭제 실패:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const clearAllData = async () => {
    if (!confirm('⚠️ 정말 모든 데이터를 삭제할까요?\n이 작업은 되돌릴 수 없습니다!')) return;
    if (!confirm('마지막 확인: 진짜 삭제할까요?')) return;

    setActionLoading('all');
    try {
      const res = await fetch('/api/admin/clear-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_ALL_DATA' }),
      });
      const data = await res.json();
      alert(data.message || '완료!');
      fetchData();
    } catch (error) {
      console.error('삭제 실패:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const clearSupabaseStorage = async () => {
    if (!confirm('⚠️ Supabase Storage의 모든 이미지를 삭제할까요?')) return;

    setActionLoading('supabase');
    try {
      const res = await fetch('/api/admin/clear-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE_STORAGE' }),
      });
      const data = await res.json();
      alert(data.message || '완료!');
    } catch (error) {
      console.error('삭제 실패:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const totalCount = collections.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>🗄️ 데이터 관리</h1>
      </header>

      {/* 전체 통계 */}
      <div className={styles.totalStats}>
        <div className={styles.totalLabel}>전체 데이터</div>
        <div className={styles.totalValue}>{totalCount.toLocaleString()}개</div>
      </div>

      {/* 컬렉션 목록 */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📊 MongoDB 컬렉션</h2>
        {loading ? (
          <div className={styles.loading}>로딩 중...</div>
        ) : (
          <div className={styles.collectionList}>
            {collections.map((col) => (
              <div key={col.name} className={styles.collectionCard}>
                <div className={styles.collectionInfo}>
                  <div className={styles.collectionName}>{col.name}</div>
                  <div className={styles.collectionCount}>{col.count.toLocaleString()}개</div>
                </div>
                <button
                  className={styles.deleteBtn}
                  onClick={() => clearCollection(col.name)}
                  disabled={actionLoading === col.name || col.count === 0}
                >
                  {actionLoading === col.name ? '삭제 중...' : '🗑️ 비우기'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 위험 구역 */}
      <section className={styles.dangerZone}>
        <h2 className={styles.sectionTitle}>⚠️ 위험 구역</h2>
        <div className={styles.dangerButtons}>
          <button
            className={styles.dangerBtn}
            onClick={clearAllData}
            disabled={actionLoading === 'all'}
          >
            {actionLoading === 'all' ? '삭제 중...' : '🗑️ MongoDB 전체 삭제'}
          </button>
          <button
            className={styles.dangerBtn}
            onClick={clearSupabaseStorage}
            disabled={actionLoading === 'supabase'}
          >
            {actionLoading === 'supabase' ? '삭제 중...' : '☁️ Supabase Storage 비우기'}
          </button>
        </div>
        <p className={styles.dangerNote}>
          ⚠️ 삭제된 데이터는 복구할 수 없습니다!
        </p>
      </section>
    </div>
  );
}

