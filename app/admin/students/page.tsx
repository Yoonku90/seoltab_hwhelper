'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

interface Student {
  _id: string;
  studentId: string;
  name: string;
  nickname?: string;
  grade: string;
  createdAt: string;
  updatedAt: string;
  agentMemory?: {
    totalSessions?: number;
    recentTopics?: string[];
  };
}

interface StudentStats {
  reviewProgramCount: number;
  imageUploadCount: number;
  lastActivity?: string;
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentStats, setStudentStats] = useState<Record<string, StudentStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/admin/students');
      const data = await res.json();
      setStudents(data.students || []);
      setStudentStats(data.stats || {});
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!confirm(`정말 이 학생을 삭제할까요? (studentId: ${studentId})`)) return;
    
    try {
      const res = await fetch(`/api/admin/students?studentId=${studentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const createToken = async (studentId: string) => {
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, expiresInDays: 30 }),
      });
      const data = await res.json();
      if (data.success) {
        const url = `${window.location.origin}${data.accessUrl}`;
        await navigator.clipboard.writeText(url);
        alert(`✅ 링크 복사됨!\n${url}`);
      }
    } catch (error) {
      console.error('토큰 생성 실패:', error);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.studentId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Link href="/admin" className={styles.backBtn}>← 뒤로</Link>
        <h1 className={styles.title}>👨‍🎓 학생 관리</h1>
      </header>

      {/* 검색 */}
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="학생 이름 또는 ID 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      {/* 학생 목록 */}
      {loading ? (
        <div className={styles.loading}>로딩 중...</div>
      ) : filteredStudents.length === 0 ? (
        <div className={styles.empty}>등록된 학생이 없습니다.</div>
      ) : (
        <div className={styles.studentList}>
          {filteredStudents.map((student) => {
            const stats = studentStats[student.studentId] || {};
            return (
              <div key={student._id} className={styles.studentCard}>
                <div className={styles.studentInfo}>
                  <div className={styles.studentName}>
                    {student.name || '이름 없음'}
                    <span className={styles.gradeBadge}>{student.grade}</span>
                  </div>
                  <div className={styles.studentId}>ID: {student.studentId}</div>
                  <div className={styles.studentMeta}>
                    📚 복습 {stats.reviewProgramCount || 0}회 | 
                    🖼️ 이미지 {stats.imageUploadCount || 0}개 |
                    🎯 세션 {student.agentMemory?.totalSessions || 0}회
                  </div>
                  {Array.isArray(student.agentMemory?.recentTopics) && student.agentMemory.recentTopics.length > 0 && (
                    <div className={styles.recentTopics}>
                      최근 학습: {student.agentMemory.recentTopics.slice(0, 3).join(', ')}
                    </div>
                  )}
                </div>
                <div className={styles.studentActions}>
                  <button 
                    className={styles.actionBtn}
                    onClick={() => createToken(student.studentId)}
                  >
                    🔗 링크 복사
                  </button>
                  <Link 
                    href={`/admin/students/${student.studentId}`}
                    className={styles.actionBtn}
                  >
                    📊 상세
                  </Link>
                  <button 
                    className={`${styles.actionBtn} ${styles.danger}`}
                    onClick={() => deleteStudent(student.studentId)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

