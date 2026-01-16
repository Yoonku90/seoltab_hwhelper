'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Summary {
  _id: string;
  title: string;
  studentId: string;
  studentName?: string;
  studentNickname?: string;
  subject?: string;
  createdAt: string;
  metadata?: {
    roomId?: string;
    isSecretNote?: boolean;
    tutoringDatetime?: string;
  };
}

export default function AdminSummariesPage() {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchRoomId, setSearchRoomId] = useState('');
  const [searchStudentId, setSearchStudentId] = useState('');
  const [filteredSummaries, setFilteredSummaries] = useState<Summary[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchSummaries();
  }, []);

  useEffect(() => {
    // 필터링 로직
    let filtered = summaries;
    
    if (searchRoomId.trim()) {
      filtered = filtered.filter(s => 
        s.metadata?.roomId?.toLowerCase().includes(searchRoomId.toLowerCase())
      );
    }
    
    if (searchStudentId.trim()) {
      filtered = filtered.filter(s => 
        s.studentId?.toLowerCase().includes(searchStudentId.toLowerCase()) ||
        s.studentName?.toLowerCase().includes(searchStudentId.toLowerCase()) ||
        s.studentNickname?.toLowerCase().includes(searchStudentId.toLowerCase())
      );
    }
    
    setFilteredSummaries(filtered);
  }, [summaries, searchRoomId, searchStudentId]);

  const fetchSummaries = async () => {
    try {
      const res = await fetch('/api/admin/summaries');
      const data = await res.json();
      if (data.success && data.summaries) {
        setSummaries(data.summaries);
        setFilteredSummaries(data.summaries);
      }
    } catch (error) {
      console.error('요약본 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSummary = async (summaryId: string) => {
    const confirmed = window.confirm('이 요약본을 삭제할까요? 삭제 후 복구할 수 없습니다.');
    if (!confirmed) return;

    try {
      setDeletingId(summaryId);
      const res = await fetch(`/api/review-programs/${summaryId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.error || '요약본 삭제에 실패했습니다.';
        throw new Error(message);
      }
      await fetchSummaries();
    } catch (error) {
      console.error('요약본 삭제 실패:', error);
      alert('요약본 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>✨ 요약본 목록</h1>
        <p className={styles.subtitle}>생성된 모든 요약본을 확인하고 관리할 수 있습니다</p>
      </header>

      {/* 검색 필터 */}
      <section className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Room ID 검색</label>
          <input
            type="text"
            placeholder="Room ID 입력..."
            value={searchRoomId}
            onChange={(e) => setSearchRoomId(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <div className={styles.filterGroup}>
          <label>학생 검색 (ID/이름)</label>
          <input
            type="text"
            placeholder="학생 ID 또는 이름 입력..."
            value={searchStudentId}
            onChange={(e) => setSearchStudentId(e.target.value)}
            className={styles.filterInput}
          />
        </div>
        <button
          onClick={() => {
            setSearchRoomId('');
            setSearchStudentId('');
          }}
          className={styles.clearBtn}
        >
          필터 초기화
        </button>
      </section>

      {/* 요약본 목록 */}
      <section className={styles.listSection}>
        {loading ? (
          <div className={styles.loading}>로딩 중...</div>
        ) : filteredSummaries.length === 0 ? (
          <div className={styles.empty}>
            {summaries.length === 0 
              ? '아직 생성된 요약본이 없습니다.' 
              : '검색 결과가 없습니다.'}
          </div>
        ) : (
          <div className={styles.summaryGrid}>
            {filteredSummaries.map((summary) => (
              <div key={summary._id} className={styles.summaryCard}>
                <div className={styles.cardHeader}>
                  <h3 className={styles.cardTitle}>{summary.title}</h3>
                  {summary.metadata?.isSecretNote && (
                    <span className={styles.secretBadge}>✨ 시크릿 노트</span>
                  )}
                </div>
                
                <div className={styles.cardMeta}>
                  {summary.studentName && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>👤 학생:</span>
                      <span>{summary.studentName}</span>
                      {summary.studentNickname && (
                        <span className={styles.nickname}>({summary.studentNickname})</span>
                      )}
                    </div>
                  )}
                  {summary.studentId && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>ID:</span>
                      <span>{summary.studentId}</span>
                    </div>
                  )}
                  {summary.subject && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>📚 과목:</span>
                      <span>{summary.subject}</span>
                    </div>
                  )}
                  {summary.metadata?.roomId && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>🏠 Room ID:</span>
                      <span className={styles.roomId}>{summary.metadata.roomId}</span>
                    </div>
                  )}
                  {summary.createdAt && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>📅 생성일:</span>
                      <span>{new Date(summary.createdAt).toLocaleString('ko-KR')}</span>
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <Link
                    href={`/review-programs/${summary._id}`}
                    target="_blank"
                    className={styles.viewBtn}
                  >
                    📖 요약본 보기
                  </Link>
                  {summary.metadata?.roomId && (
                    <Link
                      href={`/admin/lecture?roomId=${summary.metadata.roomId}`}
                      className={styles.sttBtn}
                    >
                      🎤 STT 보기
                    </Link>
                  )}
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteSummary(summary._id)}
                    disabled={deletingId === summary._id}
                  >
                    {deletingId === summary._id ? '삭제 중...' : '🗑️ 삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 통계 */}
      {!loading && summaries.length > 0 && (
        <section className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{summaries.length}</span>
            <span className={styles.statLabel}>전체 요약본</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{filteredSummaries.length}</span>
            <span className={styles.statLabel}>검색 결과</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>
              {new Set(summaries.map(s => s.studentId)).size}
            </span>
            <span className={styles.statLabel}>학생 수</span>
          </div>
        </section>
      )}
    </div>
  );
}

