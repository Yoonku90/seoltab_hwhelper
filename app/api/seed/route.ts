// GET /api/seed - 테스트 데이터 생성
import { NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { ObjectId } from 'mongodb';

export async function GET() {
  try {
    const assignments = await Collections.assignments();
    const problems = await Collections.problems();

    // 기존 데이터 확인
    const existing = await assignments.findOne({ studentId: 'student1' });
    if (existing) {
      return NextResponse.json({
        message: '이미 테스트 데이터가 있습니다.',
        assignmentId: existing._id?.toString(),
      });
    }

    // 테스트 과제 생성
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7); // 7일 후 마감

    const assignment = {
      studentId: 'student1',
      teacherId: 'teacher1',
      title: '영어 숙제 - 감각동사',
      description: '교재 15-20페이지 문제 풀기',
      dueAt: dueDate,
      createdAt: now,
      updatedAt: now,
      progress: {
        total: 10,
        solved: 0,
        stuck: 0,
        question: 0,
        not_started: 10,
      },
      top5Confirmed: false,
    };

    const assignmentResult = await assignments.insertOne(assignment);
    const assignmentId = assignmentResult.insertedId.toString();

    // 테스트 문제 10개 생성
    const problemList: Array<any> = [];
    for (let i = 1; i <= 10; i++) {
      const problem: any = {
        assignmentId,
        problemNumber: i,
        problemText: `${i}. 다음 중 알맞은 것을 선택하세요.\n\nYour sneakers look (new, newly).`,
        imageUrl: undefined,
        latestAttempt: {
          status: 'solved' as any,
          updatedAt: now,
          timeSpent: Math.floor(Math.random() * 300) + 60, // 60-360초
        },
        createdAt: now,
        updatedAt: now,
      };
      problemList.push(problem);
    }

    // 일부 문제를 막힘 상태로 변경
    problemList[2].latestAttempt.status = 'stuck';
    problemList[5].latestAttempt.status = 'stuck';
    problemList[7].latestAttempt.status = 'question';

    // 문제들 삽입
    await problems.insertMany(problemList);

    // 진행률 업데이트
    await assignments.updateOne(
      { _id: new ObjectId(assignmentId) } as any,
      {
        $set: {
          progress: {
            total: 10,
            solved: 7,
            stuck: 2,
            question: 1,
            not_started: 0,
          },
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: '테스트 데이터가 생성되었습니다!',
      assignmentId,
      url: `/assignments/${assignmentId}`,
    });
  } catch (error) {
    console.error('테스트 데이터 생성 오류:', error);
    return NextResponse.json(
      {
        error: '테스트 데이터 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류',
      },
      { status: 500 }
    );
  }
}

