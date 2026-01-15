'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface ImageData {
  url: string;
  index: number;
}

export default function RoomImagesPage() {
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!roomId.trim()) {
      alert('룸아이디를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError(null);
    setImages([]);
    setCurrentRoomId(null);

    try {
      const res = await fetch('/api/admin/room-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: roomId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '이미지를 가져오는데 실패했습니다.');
      }

      if (!data.urls || data.urls.length === 0) {
        setError('해당 룸아이디에서 이미지를 찾을 수 없습니다.');
        return;
      }

      setImages(
        data.urls.map((url: string, index: number) => ({
          url,
          index: index + 1,
        }))
      );
      setCurrentRoomId(data.roomId);
    } catch (err: any) {
      console.error('이미지 검색 오류:', err);
      setError(err.message || '이미지를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backLink}>
          ← 관리자 대시보드
        </Link>
        <h1 className={styles.title}>🖼️ 룸아이디 이미지 검색</h1>
        <p className={styles.subtitle}>
          Pagecall 룸아이디로 해당 룸의 모든 이미지를 확인할 수 있습니다.
        </p>
      </header>

      {/* 검색 영역 */}
      <section className={styles.searchSection}>
        <div className={styles.searchBox}>
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="룸아이디를 입력하세요 (예: 6930...d1d5)"
            className={styles.searchInput}
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !roomId.trim()}
            className={styles.searchButton}
          >
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>
      </section>

      {/* 에러 메시지 */}
      {error && (
        <div className={styles.errorBox}>
          <p>{error}</p>
        </div>
      )}

      {/* 결과 영역 */}
      {currentRoomId && (
        <section className={styles.resultSection}>
          <div className={styles.resultHeader}>
            <h2 className={styles.resultTitle}>
              룸아이디: <code className={styles.roomIdCode}>{currentRoomId}</code>
            </h2>
            <p className={styles.resultCount}>총 {images.length}개의 이미지</p>
          </div>

          {images.length > 0 && (
            <div className={styles.imageGrid}>
              {images.map((image) => (
                <div key={image.index} className={styles.imageCard}>
                  <div className={styles.imageNumber}>#{image.index}</div>
                  <img
                    src={image.url}
                    alt={`이미지 ${image.index}`}
                    className={styles.image}
                    onClick={() => {
                      // 이미지 확대 모달 열기
                      const modal = document.createElement('div');
                      modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.95);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        cursor: pointer;
                      `;
                      const img = document.createElement('img');
                      img.src = image.url;
                      img.style.cssText = `
                        max-width: 95vw;
                        max-height: 95vh;
                        object-fit: contain;
                        cursor: zoom-out;
                      `;
                      modal.appendChild(img);
                      const closeHandler = () => {
                        document.body.removeChild(modal);
                      };
                      modal.onclick = closeHandler;
                      img.onclick = (e) => e.stopPropagation();
                      document.body.appendChild(modal);
                    }}
                    style={{ cursor: 'pointer' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.png';
                    }}
                  />
                  <div className={styles.imageUrl}>
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.imageLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      새 탭에서 열기 →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 빈 상태 */}
      {!loading && !error && !currentRoomId && (
        <div className={styles.emptyState}>
          <p>룸아이디를 입력하고 검색 버튼을 눌러주세요.</p>
        </div>
      )}
    </div>
  );
}

