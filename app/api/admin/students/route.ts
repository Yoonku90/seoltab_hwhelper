import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { deleteImageFromSupabase } from '@/lib/supabase';

// GET: 학생 목록 + 통계
export async function GET() {
  try {
    const db = await getDb();
    
    // 학생 목록
    const students = await db.collection('students')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // 학생별 통계
    const stats: Record<string, any> = {};
    
    for (const student of students) {
      const studentId = student.studentId;
      
      const [reviewProgramCount, imageUploadCount, lastReviewProgram] = await Promise.all([
        db.collection('review_programs').countDocuments({ studentId }),
        db.collection('image_uploads').countDocuments({ studentId }),
        db.collection('review_programs')
          .findOne({ studentId }, { sort: { createdAt: -1 } }),
      ]);

      stats[studentId] = {
        reviewProgramCount,
        imageUploadCount,
        lastActivity: lastReviewProgram?.createdAt || null,
      };
    }

    return NextResponse.json({ students, stats });
  } catch (error) {
    console.error('[admin/students GET] Error:', error);
    return NextResponse.json({ error: '학생 목록 조회 실패' }, { status: 500 });
  }
}

// DELETE: 학생 삭제 (관련 데이터 포함)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const db = await getDb();

    // 1단계: 해당 학생의 assignments를 찾아서 assignmentId 리스트 수집
    const assignments = await db.collection('assignments')
      .find({ studentId })
      .project({ _id: 1 })
      .toArray();
    
    const assignmentIds = assignments.map(a => a._id.toString());

    // 1.5단계: Supabase Storage 파일 삭제를 위해 image_uploads 수집
    const imageUploadsToDelete = await db.collection('image_uploads')
      .find({
        $or: [
          { studentId },
          ...(assignmentIds.length > 0 ? [{ assignmentId: { $in: assignmentIds } }] : []),
        ],
      })
      .project({ supabaseBucketPath: 1 })
      .toArray();

    // Supabase Storage에서 실제 파일 삭제
    const supabaseDeleteResults = await Promise.allSettled(
      imageUploadsToDelete
        .filter(img => img.supabaseBucketPath)
        .map(img => deleteImageFromSupabase(img.supabaseBucketPath))
    );
    
    const supabaseDeletedCount = supabaseDeleteResults.filter(
      r => r.status === 'fulfilled' && r.value === true
    ).length;
    
    console.log(`[admin/students DELETE] Supabase Storage에서 ${supabaseDeletedCount}개 파일 삭제 시도`);

    // 2단계: assignmentId로 연결된 데이터 삭제
    const [
      problemsResult,
      attemptsByAssignmentResult,
      helpSessionsResult,
      teacherDigestsResult,
      aiTutorSessionsByAssignmentResult,
      learningEventsByAssignmentResult,
      imageUploadsByAssignmentResult,
    ] = await Promise.all([
      // problems: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('problems').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // attempts: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('attempts').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // help_sessions: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('help_sessions').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // teacher_digests: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('teacher_digests').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // ai_tutor_sessions: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('ai_tutor_sessions').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // learning_events: assignmentId로 삭제
      assignmentIds.length > 0
        ? db.collection('learning_events').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
      // image_uploads: assignmentId로 삭제 (MongoDB 레코드만)
      assignmentIds.length > 0
        ? db.collection('image_uploads').deleteMany({ assignmentId: { $in: assignmentIds } })
        : Promise.resolve({ deletedCount: 0 }),
    ]);

    // 3단계: assignments 삭제 (studentId로)
    const assignmentsResult = await db.collection('assignments').deleteMany({ studentId });

    // 4단계: studentId로 직접 연결된 다른 데이터 삭제
    const [
      studentResult,
      reviewProgramsResult,
      imageUploadsByStudentResult,
      accessTokensResult,
      attemptsByStudentResult,
      learningEventsByStudentResult,
      learningConsultationsResult,
      performanceTasksResult,
      aiTutorSessionsByStudentResult,
    ] = await Promise.all([
      // students: 마지막에 삭제 (다른 컬렉션에서 참조 가능성 때문)
      db.collection('students').deleteOne({ studentId }),
      // review_programs: studentId로 삭제
      db.collection('review_programs').deleteMany({ studentId }),
      // image_uploads: studentId로 삭제 (이미 assignmentId로 삭제했지만, studentId만 있는 것도 있으므로)
      db.collection('image_uploads').deleteMany({ studentId }),
      // access_tokens: studentId로 삭제
      db.collection('access_tokens').deleteMany({ studentId }),
      // attempts: studentId로 삭제 (이미 assignmentId로 삭제했지만, 추가로)
      db.collection('attempts').deleteMany({ studentId }),
      // learning_events: studentId로 삭제
      db.collection('learning_events').deleteMany({ studentId }),
      // learning_consultations: studentId로 삭제
      db.collection('learning_consultations').deleteMany({ studentId }),
      // performance_tasks: studentId로 삭제
      db.collection('performance_tasks').deleteMany({ studentId }),
      // ai_tutor_sessions: studentId로 삭제
      db.collection('ai_tutor_sessions').deleteMany({ studentId }),
    ]);

    // 중복 카운트: assignmentId로 삭제한 건 이후 studentId로 삭제할 때 0을 반환
    // 따라서 합산해도 실제 삭제 수와 같음 (assignmentId로 삭제된 건은 studentId로 삭제 안 됨)
    const totalImageUploadsDeleted = 
      imageUploadsByAssignmentResult.deletedCount + 
      imageUploadsByStudentResult.deletedCount;

    const totalAttemptsDeleted = 
      attemptsByAssignmentResult.deletedCount + 
      attemptsByStudentResult.deletedCount;

    const totalLearningEventsDeleted = 
      learningEventsByAssignmentResult.deletedCount + 
      learningEventsByStudentResult.deletedCount;

    const totalAiTutorSessionsDeleted = 
      aiTutorSessionsByAssignmentResult.deletedCount + 
      aiTutorSessionsByStudentResult.deletedCount;

    return NextResponse.json({
      success: true,
      deleted: {
        students: studentResult.deletedCount,
        assignments: assignmentsResult.deletedCount,
        problems: problemsResult.deletedCount,
        reviewPrograms: reviewProgramsResult.deletedCount,
        imageUploads: totalImageUploadsDeleted,
        supabaseFiles: supabaseDeletedCount, // Supabase Storage에서 삭제된 파일 수
        accessTokens: accessTokensResult.deletedCount,
        attempts: totalAttemptsDeleted,
        helpSessions: helpSessionsResult.deletedCount,
        teacherDigests: teacherDigestsResult.deletedCount,
        learningEvents: totalLearningEventsDeleted,
        learningConsultations: learningConsultationsResult.deletedCount,
        performanceTasks: performanceTasksResult.deletedCount,
        aiTutorSessions: totalAiTutorSessionsDeleted,
      },
    });
  } catch (error) {
    console.error('[admin/students DELETE] Error:', error);
    return NextResponse.json({ error: '삭제 실패' }, { status: 500 });
  }
}

