import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';

// GET /api/teachers/:id/dashboard - 선생님 대시보드
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: teacherId } = await params;

    const assignments = await Collections.assignments();
    const assignmentList = await assignments
      .find({ teacherId })
      .sort({ dueAt: 1 })
      .toArray();

    // 각 과제에 대해 상세 정보 수집
    const dashboardData = await Promise.all(
      assignmentList.map(async (assignment) => {
        const teacherDigests = await Collections.teacher_digests();
        const digest = await teacherDigests.findOne({
          assignmentId: assignment._id?.toString(),
        });

        return {
          assignmentId: assignment._id?.toString(),
          title: assignment.title,
          studentId: assignment.studentId,
          dueAt: assignment.dueAt,
          progress: assignment.progress,
          lastActivityAt: assignment.lastActivityAt,
          top5Confirmed: assignment.top5Confirmed,
          top5ConfirmedAt: assignment.top5ConfirmedAt,
          digest: digest
            ? {
                top5Problems: digest.top5Problems,
                summary: digest.summary,
                generatedAt: digest.generatedAt,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ dashboard: dashboardData });
  } catch (error) {
    console.error('대시보드 조회 오류:', error);
    return NextResponse.json(
      { error: '대시보드를 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

