'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

export default function ReviewProgramsPage() {
  const searchParams = useSearchParams();
  const urlStudentId = searchParams.get('studentId');
  
  const [studentId, setStudentId] = useState(urlStudentId || 'guest');
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<any[]>([]);
  
  // URL 파라미터 변경 감지
  useEffect(() => {
    if (urlStudentId && urlStudentId !== studentId) {
      setStudentId(urlStudentId);
    }
  }, [urlStudentId]);
  
  // 학생 이름 불러오기
  useEffect(() => {
    const loadStudentName = async () => {
      try {
        const res = await fetch(`/api/students?studentId=${studentId}`);
        const data = await res.json();
        if (data.exists && data.student) {
          setStudentName(data.student.name);
        }
      } catch (e) {
        console.error(e);
      }
    };
    if (studentId) loadStudentName();
  }, [studentId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/review-programs?studentId=${studentId}`);
        const data = await res.json();
        setList(data.reviewPrograms || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  return (
    <div className={styles.container}>
      <h1>{studentName ? `${studentName}의 복습 프로그램` : '복습 프로그램'} 📚</h1>
      <p className={styles.desc}>
        {studentName ? `${studentName}아, 여기서 복습 프로그램을 다시 열 수 있어! 🐰` : '오늘 만든 복습 프로그램을 여기서 다시 열 수 있어요.'}
      </p>

      <div className={styles.card}>
        {/* 학생 정보 배지 */}
        {studentName && (
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)',
            borderRadius: 12,
            padding: '6px 12px',
            marginBottom: 12,
            fontSize: 14,
          }}>
            <span>👋</span>
            <span style={{ fontWeight: 700, color: '#1976d2' }}>{studentName}</span>
          </div>
        )}

        {loading ? (
          <div>로딩 중...</div>
        ) : list.length === 0 ? (
          <div>아직 복습 프로그램이 없어요. 홈에서 만들어보자 🐰</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((rp) => (
              <div
                key={rp._id}
                style={{
                  border: '1px solid #eee',
                  borderRadius: 12,
                  padding: 12,
                  background: '#fff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Link
                  href={`/admin/lecture-summary?reviewProgramId=${rp._id}`}
                  style={{
                    flex: 1,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontWeight: 800 }}>{rp.title}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                    {rp.durationMinutes ? `${rp.durationMinutes}분` : ''}{' '}
                    {rp.createdAt ? `· ${new Date(rp.createdAt).toLocaleString('ko-KR')}` : ''}
                  </div>
                </Link>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm('이 복습 프로그램을 삭제할까요?')) return;
                    try {
                      const res = await fetch(`/api/review-programs/${rp._id}`, {
                        method: 'DELETE',
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || '삭제 실패');
                      // 목록에서 제거
                      setList((prev) => prev.filter((item) => item._id !== rp._id));
                    } catch (error) {
                      console.error(error);
                      alert('삭제 중 오류가 발생했습니다.');
                    }
                  }}
                  style={{
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#666',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f5f5f5';
                    e.currentTarget.style.color = '#d32f2f';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.color = '#666';
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


