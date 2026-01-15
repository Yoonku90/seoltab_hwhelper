'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Room {
  room_id: string;
  lvt?: string;
  subject?: string;
  tutoring_datetime?: string;
  durations?: number;
  is_stt?: boolean;
  text_aggregation?: boolean;
  cycle_state?: string;
}

interface SearchResult {
  search_type: 'lvt' | 'room_id' | 'user_id';
  search_value: string;
  total_count: number;
  rooms: Room[];
}

interface Conversation {
  index: number;
  speaker: string;
  text: string;
  timestamp?: any;
}

interface AnalysisData {
  originalConversations: Conversation[];
  correctedConversations: Conversation[];
  summary: string;
  studentQuestions: Array<{
    index: number;
    question: string;
    teacherResponse?: string;
  }>;
}

export default function LectureSearchPage() {
  const [lvt, setLvt] = useState('');
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lvt && !roomId && !userId) {
      setError('LVT, Room ID, 또는 User ID 중 하나를 입력하세요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedRoom(null);
    setAnalysisData(null);

    try {
      let queryParam = '';
      if (lvt) {
        queryParam = `lvt=${encodeURIComponent(lvt)}`;
      } else if (roomId) {
        queryParam = `roomId=${encodeURIComponent(roomId)}`;
      } else if (userId) {
        queryParam = `userId=${encodeURIComponent(userId)}`;
      }
      
      const res = await fetch(`/api/lecture/search?${queryParam}`);
      const data: SearchResult = await res.json();
      
      if (!res.ok) {
        throw new Error((data as any).error || '검색 실패');
      }

      setRooms(data.rooms || []);
      if (data.rooms.length === 0) {
        setError('검색 결과가 없습니다.');
      }
    } catch (err: any) {
      setError(err.message || '검색 중 오류가 발생했습니다.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoomSelect = async (room: Room) => {
    setSelectedRoom(room);
    setIsLoadingText(true);
    setAnalysisData(null);
    setError(null);

    try {
      // STT 분석 API 호출
      const res = await fetch('/api/lecture/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: room.room_id }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'STT 분석 실패');
      }

      setAnalysisData(data);
    } catch (err: any) {
      setError(err.message || 'STT 분석 중 오류가 발생했습니다.');
      console.error('STT analysis error:', err);
    } finally {
      setIsLoadingText(false);
    }
  };

  const handleBackToList = () => {
    setSelectedRoom(null);
    setAnalysisData(null);
  };

  // 화자 표시명 정규화
  const normalizeSpeaker = (speaker: string): { name: string; type: 'teacher' | 'student' | 'unknown' } => {
    const s = speaker.toLowerCase();
    if (s.includes('teacher') || s.includes('선생') || s.includes('teacher') || s === 't' || s === '선생님') {
      return { name: '선생님', type: 'teacher' };
    }
    if (s.includes('student') || s.includes('학생') || s === 's' || s === '학생') {
      return { name: '학생', type: 'student' };
    }
    return { name: speaker, type: 'unknown' };
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>🎤 수업 STT 검색</h1>
        <p className={styles.subtitle}>LVT, Room ID, 또는 User ID로 수업 STT 데이터를 검색할 수 있습니다.</p>
      </header>

      <main className={styles.main}>
        {!selectedRoom ? (
          <>
            {/* 검색 폼 */}
            <div className={styles.searchCard}>
              <h2 className={styles.cardTitle}>수업 검색</h2>
              <form onSubmit={handleSearch} className={styles.searchForm}>
                <div className={styles.inputGrid}>
                  <div>
                    <label htmlFor="lvt" className={styles.label}>
                      LVT
                    </label>
                    <input
                      id="lvt"
                      type="text"
                      value={lvt}
                      onChange={(e) => {
                        setLvt(e.target.value);
                        setRoomId('');
                        setUserId('');
                      }}
                      placeholder="LVT를 입력하세요"
                      className={styles.input}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="roomId" className={styles.label}>
                      Room ID
                    </label>
                    <input
                      id="roomId"
                      type="text"
                      value={roomId}
                      onChange={(e) => {
                        setRoomId(e.target.value);
                        setLvt('');
                        setUserId('');
                      }}
                      placeholder="Room ID를 입력하세요"
                      className={styles.input}
                      disabled={isLoading}
                    />
                  </div>
                  <div>
                    <label htmlFor="userId" className={styles.label}>
                      User ID
                    </label>
                    <input
                      id="userId"
                      type="text"
                      value={userId}
                      onChange={(e) => {
                        setUserId(e.target.value);
                        setLvt('');
                        setRoomId('');
                      }}
                      placeholder="User ID를 입력하세요"
                      className={styles.input}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || (!lvt && !roomId && !userId)}
                  className={styles.searchButton}
                >
                  {isLoading ? (
                    <>
                      <div className={styles.spinner}></div>
                      <span>검색 중...</span>
                    </>
                  ) : (
                    <>
                      <svg className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>검색</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className={styles.errorCard}>
                <svg className={styles.errorIcon} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className={styles.errorText}>{error}</p>
              </div>
            )}

            {/* 검색 결과 */}
            {rooms.length > 0 && (
              <div className={styles.resultsCard}>
                <div className={styles.resultsHeader}>
                  <h2 className={styles.cardTitle}>검색 결과 ({rooms.length}개)</h2>
                </div>
                <div className={styles.roomList}>
                  {rooms.map((room) => (
                    <div
                      key={room.room_id}
                      onClick={() => handleRoomSelect(room)}
                      className={styles.roomItem}
                    >
                      <div className={styles.roomContent}>
                        <div className={styles.roomHeader}>
                          <h3 className={styles.roomId}>{room.room_id}</h3>
                          {room.cycle_state === 'DONE' ? (
                            <span className={styles.badgeSuccess}>완료</span>
                          ) : (
                            <span className={styles.badgeWarning}>진행중</span>
                          )}
                        </div>
                        <div className={styles.roomMeta}>
                          {room.lvt && <span>LVT: {room.lvt}</span>}
                          {room.subject && <span>과목: {room.subject}</span>}
                          {room.tutoring_datetime && (
                            <span>
                              수업날짜: {new Date(room.tutoring_datetime).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          )}
                          {room.durations && <span>수업시간: {room.durations}분</span>}
                          {room.is_stt !== undefined && (
                            <span>STT 대상: {room.is_stt ? '예' : '아니오'}</span>
                          )}
                        </div>
                      </div>
                      <svg className={styles.arrowIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* STT 텍스트 상세 보기 - 2열 레이아웃 */
          <div className={styles.detailCard}>
            <button onClick={handleBackToList} className={styles.backButton}>
              <svg className={styles.backIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              목록으로
            </button>

            <div className={styles.roomInfo}>
              <h2 className={styles.detailTitle}>{selectedRoom.room_id}</h2>
              <div className={styles.roomMeta}>
                {selectedRoom.lvt && <span>LVT: {selectedRoom.lvt}</span>}
                {selectedRoom.subject && <span>과목: {selectedRoom.subject}</span>}
                {selectedRoom.tutoring_datetime && (
                  <span>
                    수업날짜: {new Date(selectedRoom.tutoring_datetime).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
            </div>

            {isLoadingText ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
                <p>STT 데이터를 분석하는 중...</p>
              </div>
            ) : error ? (
              <div className={styles.errorCard}>
                <p className={styles.errorText}>{error}</p>
              </div>
            ) : analysisData ? (
              <div className={styles.sttLayout}>
                {/* 왼쪽 열: 요약 및 학생 질문 */}
                <div className={styles.leftColumn}>
                  <div className={styles.summarySection}>
                    <h3 className={styles.sectionTitle}>📝 수업 요약</h3>
                    <div className={styles.summaryContent}>
                      {analysisData.summary ? (
                        <div className={styles.summaryText}>
                          {analysisData.summary.split('\n').map((line, idx) => (
                            <p key={idx}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.emptyText}>요약이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  {analysisData.studentQuestions.length > 0 && (
                    <div className={styles.questionsSection}>
                      <h3 className={styles.sectionTitle}>❓ 학생 질문</h3>
                      <div className={styles.questionsList}>
                        {analysisData.studentQuestions.map((q, idx) => (
                          <div key={idx} className={styles.questionItem}>
                            <div className={styles.questionNumber}>Q{idx + 1}</div>
                            <div className={styles.questionContent}>
                              <div className={styles.questionText}>{q.question}</div>
                              {q.teacherResponse && (
                                <div className={styles.teacherResponse}>
                                  <strong>선생님 답변:</strong> {q.teacherResponse}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 오른쪽 열: 대화 내용 */}
                <div className={styles.rightColumn}>
                  <h3 className={styles.sectionTitle}>💬 수업 대화</h3>
                  <div className={styles.conversationList}>
                    {analysisData.correctedConversations.map((conv, idx) => {
                      const speakerInfo = normalizeSpeaker(conv.speaker);
                      return (
                        <div
                          key={idx}
                          className={`${styles.conversationItem} ${styles[`conversationItem${speakerInfo.type === 'teacher' ? 'Teacher' : speakerInfo.type === 'student' ? 'Student' : 'Unknown'}`]}`}
                        >
                          <div className={styles.conversationHeader}>
                            <span className={styles.speakerName}>{speakerInfo.name}</span>
                            <span className={styles.conversationIndex}>#{conv.index || idx + 1}</span>
                          </div>
                          <div className={styles.conversationText}>{conv.text}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.errorCard}>
                <p className={styles.errorText}>STT 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
