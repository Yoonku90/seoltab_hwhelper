'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import MarkdownMath from '@/app/components/MarkdownMath';

type ChatMsg = {
  from: 'tutor' | 'student';
  text: string;
  imageUrl?: string;
};

type TutorType = 'rangsam' | 'joonssam';

export default function HomeworkPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlStudentId = searchParams.get('studentId');
  const urlTutor = searchParams.get('tutor') as TutorType | null;

  const [studentId, setStudentId] = useState(urlStudentId || 'guest');
  const [studentName, setStudentName] = useState('');
  const [tutor, setTutor] = useState<TutorType>(urlTutor || 'rangsam');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentImageId, setCurrentImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 학생 이름 불러오기
  useEffect(() => {
    const loadStudentName = async () => {
      if (studentId === 'guest') return;
      try {
        const res = await fetch(`/api/students?studentId=${studentId}`);
        const data = await res.json();
        if (data.exists && data.student) {
          setStudentName(data.student.name);
        }
      } catch (e) {
        console.error('학생 이름 로드 실패:', e);
      }
    };
    loadStudentName();
  }, [studentId]);

  // 채팅 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  // 초기 인사 메시지
  useEffect(() => {
    if (chat.length === 0) {
      const tutorName = tutor === 'joonssam' ? '준쌤' : '랑쌤';
      const greeting = studentName 
        ? `${studentName}아! 비법 노트 다 봤어? 숙제도 도와줄 수 있는데, 지금 같이 해볼래? 📚`
        : `안녕! 비법 노트 다 봤어? 숙제도 도와줄 수 있는데, 지금 같이 해볼래? 📚`;
      
      setChat([{ from: 'tutor', text: greeting }]);
    }
  }, [tutor, studentName]);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있어요!');
      return;
    }

    setUploading(true);
    setPreview(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentId', studentId);

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '업로드 실패');
      }

      const imageUploadId = data.imageUpload?._id || data.imageUploadId;
      setCurrentImageId(imageUploadId);

      // 이미지 분석
      if (imageUploadId) {
        await analyzeImage(imageUploadId, data.imageUrl);
      }

      // 채팅에 이미지 추가
      setChat(prev => [...prev, {
        from: 'student',
        text: '숙제 사진 올렸어!',
        imageUrl: data.imageUrl,
      }]);
    } catch (error: any) {
      console.error('업로드 오류:', error);
      alert(error.message || '이미지 업로드에 실패했습니다.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const analyzeImage = async (imageUploadId: string, imageUrl: string) => {
    try {
      const res = await fetch('/api/images/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUploadId, studentId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '분석 실패');
      }

      // 튜터 응답 생성
      await getTutorResponse(data.analysis, imageUrl);
    } catch (error: any) {
      console.error('분석 오류:', error);
      alert('이미지 분석 중 오류가 발생했습니다.');
    }
  };

  const getTutorResponse = async (analysis: any, imageUrl: string) => {
    setSending(true);
    try {
      const res = await fetch('/api/homework/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          studentName,
          tutor,
          analysis,
          imageUrl,
          chatHistory: chat,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '응답 생성 실패');
      }

      setChat(prev => [...prev, {
        from: 'tutor',
        text: data.message,
      }]);
    } catch (error: any) {
      console.error('튜터 응답 오류:', error);
      alert('응답 생성 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    const msg = input.trim();
    if (!msg) return;

    setChat(prev => [...prev, { from: 'student', text: msg }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/homework/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          studentName,
          tutor,
          message: msg,
          chatHistory: chat,
          currentImageId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '응답 생성 실패');
      }

      setChat(prev => [...prev, {
        from: 'tutor',
        text: data.message,
      }]);
    } catch (error: any) {
      console.error('메시지 전송 오류:', error);
      alert('메시지 전송 중 오류가 발생했습니다.');
    } finally {
      setSending(false);
    }
  };

  const tutorName = tutor === 'joonssam' ? '준쌤' : '랑쌤';
  const tutorImage = tutor === 'joonssam' ? '/joonssam.png' : '/rangssam.png';
  const tutorEmoji = tutor === 'joonssam' ? '👨‍🏫' : '👩‍🏫';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/home" className={styles.backBtn}>← 홈</Link>
        <div>
          <h1 className={styles.title}>📚 숙제 도와주기</h1>
          <div className={styles.meta}>
            {studentName && <span className={styles.studentTag}>👋 {studentName}</span>}
            <button
              onClick={() => setTutor(tutor === 'rangsam' ? 'joonssam' : 'rangsam')}
              className={styles.tutorSwitch}
            >
              {tutor === 'rangsam' ? '준쌤으로 바꾸기' : '랑쌤으로 바꾸기'}
            </button>
          </div>
        </div>
      </header>

      <section className={styles.chatCard}>
        <div className={styles.chatHeader}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatarFrame}>
              <img
                className={styles.avatarImg}
                src={tutorImage}
                alt={tutorName}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  const next = (e.currentTarget as HTMLImageElement)
                    .nextElementSibling as HTMLDivElement | null;
                  if (next) next.style.display = 'flex';
                }}
              />
              <div className={styles.avatarEmojiFallback}>{tutorEmoji}</div>
            </div>
            <div className={styles.avatarName}>{tutorName}</div>
          </div>
        </div>

        <div className={styles.chatLog}>
          {chat.map((m, idx) => {
            const isTutor = m.from === 'tutor';
            return (
              <div
                key={idx}
                className={`${styles.msgRow} ${isTutor ? styles.msgRowTutor : styles.msgRowStudent}`}
              >
                {isTutor ? (
                  <div className={styles.msgAvatar}>
                    <div className={styles.avatarFrame}>
                      <img
                        className={styles.avatarImg}
                        src={tutorImage}
                        alt={tutorName}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                          const next = (e.currentTarget as HTMLImageElement)
                            .nextElementSibling as HTMLDivElement | null;
                          if (next) next.style.display = 'flex';
                        }}
                      />
                      <div className={styles.avatarEmojiFallback}>{tutorEmoji}</div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.msgAvatarSpacer} />
                )}

                <div
                  className={`${styles.bubble} ${isTutor ? styles.bubbleTutor : styles.bubbleStudent}`}
                >
                  {m.imageUrl && (
                    <div className={styles.chatImage}>
                      <img src={m.imageUrl} alt="숙제 이미지" />
                    </div>
                  )}
                  <MarkdownMath content={m.text} />
                </div>
              </div>
            );
          })}
          <div ref={chatEndRef} />
        </div>

        {/* 이미지 미리보기 */}
        {preview && (
          <div className={styles.previewContainer}>
            <img src={preview} alt="미리보기" />
            <button
              onClick={() => {
                setPreview(null);
                setCurrentImageId(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className={styles.removePreview}
            >
              ✕
            </button>
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className={styles.fileInput}
            id="file-input"
            disabled={uploading || sending}
          />
          <label htmlFor="file-input" className={styles.fileButton}>
            📷
          </label>
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="숙제 문제를 물어봐! 또는 사진을 올려줘 📚"
            disabled={sending || uploading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            className={styles.sendBtn}
            disabled={sending || uploading || !input.trim()}
            onClick={handleSendMessage}
          >
            {sending ? '...' : '전송'}
          </button>
        </div>
      </section>
    </div>
  );
}

