import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await getDb();
    
    // 기본 통계
    const [totalStudents, totalReviewPrograms] = await Promise.all([
      db.collection('students').countDocuments(),
      db.collection('review_programs').countDocuments(),
    ]);

    // 학생별 총 세션 수 합계
    const studentsWithSessions = await db.collection('students')
      .find({})
      .project({ 'agentMemory.totalSessions': 1 })
      .toArray();
    
    const totalSessions = studentsWithSessions.reduce(
      (sum, s) => sum + (s.agentMemory?.totalSessions || 0), 
      0
    );

    // 과목별 분포
    const reviewPrograms = await db.collection('review_programs')
      .find({})
      .project({ subject: 1 })
      .toArray();
    
    const subjectDistribution: Record<string, number> = {};
    for (const rp of reviewPrograms) {
      const subject = rp.subject || '미분류';
      subjectDistribution[subject] = (subjectDistribution[subject] || 0) + 1;
    }

    // 학년별 분포
    const students = await db.collection('students')
      .find({})
      .project({ grade: 1 })
      .toArray();
    
    const gradeDistribution: Record<string, number> = {};
    for (const s of students) {
      const grade = s.grade || '미설정';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    }

    // 인기 주제 (recentTopics에서 추출)
    const studentsWithTopics = await db.collection('students')
      .find({})
      .project({ 'agentMemory.recentTopics': 1 })
      .toArray();
    
    const topicCounts: Record<string, number> = {};
    for (const s of studentsWithTopics) {
      const topics = s.agentMemory?.recentTopics || [];
      for (const topic of topics) {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      }
    }
    
    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    // 최근 활동 (복습 프로그램 생성 기준)
    const recentPrograms = await db.collection('review_programs')
      .find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();
    
    // 학생 이름 조회
    const studentIds = [...new Set(recentPrograms.map(rp => rp.studentId))];
    const studentDocs = await db.collection('students')
      .find({ studentId: { $in: studentIds } })
      .project({ studentId: 1, name: 1 })
      .toArray();
    
    const studentNameMap: Record<string, string> = {};
    for (const s of studentDocs) {
      studentNameMap[s.studentId] = s.name;
    }

    const recentActivity = recentPrograms.map(rp => ({
      studentId: rp.studentId,
      studentName: studentNameMap[rp.studentId] || null,
      action: '복습 시작',
      subject: rp.subject,
      timestamp: rp.createdAt,
    }));

    return NextResponse.json({
      totalStudents,
      totalSessions,
      totalReviewPrograms,
      subjectDistribution,
      gradeDistribution,
      topTopics,
      recentActivity,
    });
  } catch (error) {
    console.error('[admin/analytics] Error:', error);
    return NextResponse.json({ error: '분석 데이터 조회 실패' }, { status: 500 });
  }
}

