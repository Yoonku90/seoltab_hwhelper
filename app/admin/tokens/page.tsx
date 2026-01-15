'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Token {
  _id: string;
  token: string;
  studentId: string;
  studentName?: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
}

export default function TokenManagementPage() {
  const [studentId, setStudentId] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  
  // 토큰 목록
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      const res = await fetch('/api/admin/tokens');
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error('토큰 목록 로드 실패:', err);
    } finally {
      setLoadingTokens(false);
    }
  };

  const generateToken = async () => {
    if (!studentId.trim()) {
      setError('학생 ID를 입력해주세요');
      return;
    }

    setLoading(true);
    setError('');
    setCopied(false);

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentId: studentId.trim(),
          expiresInDays,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const baseUrl = window.location.origin;
        setGeneratedLink(`${baseUrl}${data.accessUrl}`);
        fetchTokens(); // 목록 새로고침
      } else {
        setError(data.error || '토큰 생성 실패');
      }
    } catch (err) {
      setError('서버 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const deleteToken = async (tokenId: string) => {
    if (!confirm('이 토큰을 삭제할까요?')) return;

    try {
      await fetch(`/api/admin/tokens?id=${tokenId}`, { method: 'DELETE' });
      fetchTokens();
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.pageTitle}>🔗 토큰 관리</h1>
      </header>

      <div className={styles.content}>
        {/* 생성 카드 */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}>🔐</span>
            <h2 className={styles.title}>학생 접근 링크 생성</h2>
            <p className={styles.subtitle}>학생에게 보낼 보안 링크를 만들어요</p>
          </div>

          <div className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>학생 ID</label>
              <input
                type="text"
                className={styles.input}
                placeholder="예: 586694_481"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              />
              <div className={styles.hint}>
                형식: 유저번호_학년코드 (예: 586694_481 = 고2)
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.label}>유효 기간</label>
              <select
                className={styles.select}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
              >
                <option value={7}>7일</option>
                <option value={30}>30일</option>
                <option value={90}>90일</option>
                <option value={180}>180일</option>
                <option value={365}>1년</option>
              </select>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.generateBtn}
              onClick={generateToken}
              disabled={loading}
            >
              {loading ? '생성 중...' : '🔗 링크 생성하기'}
            </button>
          </div>

          {generatedLink && (
            <div className={styles.result}>
              <div className={styles.resultLabel}>📎 생성된 링크</div>
              <div className={styles.linkBox}>
                <input
                  type="text"
                  className={styles.linkInput}
                  value={generatedLink}
                  readOnly
                />
                <button
                  className={styles.copyBtn}
                  onClick={() => copyToClipboard(generatedLink)}
                >
                  {copied ? '✅ 복사됨!' : '📋 복사'}
                </button>
              </div>
            </div>
          )}

          <details className={styles.gradeInfo}>
            <summary className={styles.gradeTitle}>📚 학년 코드 참고</summary>
            <div className={styles.gradeGrid}>
              <div>695=초1</div>
              <div>696=초2</div>
              <div>697=초3</div>
              <div>698=초4</div>
              <div>699=초5</div>
              <div>700=초6</div>
              <div>477=중1</div>
              <div>478=중2</div>
              <div>479=중3</div>
              <div>480=고1</div>
              <div>481=고2</div>
              <div>482=고3</div>
              <div>483=일반인</div>
              <div>484=N수생</div>
            </div>
          </details>
        </div>

        {/* 토큰 목록 */}
        <div className={styles.tokenListCard}>
          <h2 className={styles.listTitle}>📋 발급된 토큰 목록</h2>
          
          {loadingTokens ? (
            <div className={styles.loading}>로딩 중...</div>
          ) : tokens.length === 0 ? (
            <div className={styles.empty}>발급된 토큰이 없습니다.</div>
          ) : (
            <div className={styles.tokenList}>
              {tokens.map((token) => (
                <div 
                  key={token._id} 
                  className={`${styles.tokenItem} ${isExpired(token.expiresAt) ? styles.expired : ''}`}
                >
                  <div className={styles.tokenInfo}>
                    <div className={styles.tokenStudentId}>
                      {token.studentName || token.studentId}
                      {isExpired(token.expiresAt) && (
                        <span className={styles.expiredBadge}>만료됨</span>
                      )}
                    </div>
                    <div className={styles.tokenMeta}>
                      토큰: {token.token.slice(0, 8)}*** | 
                      생성: {new Date(token.createdAt).toLocaleDateString('ko-KR')} | 
                      만료: {new Date(token.expiresAt).toLocaleDateString('ko-KR')}
                      {token.lastUsedAt && (
                        <> | 마지막 사용: {new Date(token.lastUsedAt).toLocaleDateString('ko-KR')}</>
                      )}
                    </div>
                  </div>
                  <div className={styles.tokenActions}>
                    <button
                      className={styles.copySmallBtn}
                      onClick={() => copyToClipboard(`${window.location.origin}/home?token=${token.token}`)}
                    >
                      📋
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteToken(token._id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

