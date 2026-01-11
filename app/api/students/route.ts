import { NextRequest, NextResponse } from 'next/server';
import { Collections } from '@/lib/db';
import { Student } from '@/lib/types';
import { ObjectId } from 'mongodb';

/**
 * 한국어 이름 마지막 글자에 받침이 있는지 확인
 * - 받침 있으면: ~아 (오웬아, 민서아)
 * - 받침 없으면: ~야 (지니야, 수아야)
 */
function hasKoreanBatchim(name: string): boolean {
  if (!name || name.length === 0) return false;
  const lastChar = name.charAt(name.length - 1);
  const code = lastChar.charCodeAt(0);
  
  // 한글 범위: 0xAC00 ~ 0xD7A3
  if (code < 0xAC00 || code > 0xD7A3) {
    // 한글이 아닌 경우 (영어 등) → 기본값 ~야
    return false;
  }
  
  // 한글 유니코드 구조: (초성 * 21 + 중성) * 28 + 종성
  // 종성(받침)이 0이면 받침 없음
  const jongseong = (code - 0xAC00) % 28;
  return jongseong !== 0;
}

/**
 * 이름에 맞는 호칭 생성
 * - 받침 있으면: 오웬아
 * - 받침 없으면: 지니야
 */
function createNickname(name: string): string {
  if (!name) return '';
  const suffix = hasKoreanBatchim(name) ? '아' : '야';
  return `${name}${suffix}`;
}

/**
 * 설탭 학년 고유번호 → 학년 문자열 변환
 */
const GRADE_CODE_MAP: Record<number, string> = {
  695: '초1', 696: '초2', 697: '초3', 698: '초4', 699: '초5', 700: '초6',
  477: '중1', 478: '중2', 479: '중3',
  480: '고1', 481: '고2', 482: '고3',
  483: '일반인', 484: 'N수생',
};

function getGradeFromCode(gradeCode: number | string): string {
  const code = typeof gradeCode === 'string' ? parseInt(gradeCode, 10) : gradeCode;
  return GRADE_CODE_MAP[code] || '미설정';
}

/**
 * studentId에서 학년 코드 추출 (예: "586694_481" → 481)
 */
function extractGradeCodeFromStudentId(studentId: string): number | null {
  if (!studentId) return null;
  const parts = studentId.split('_');
  if (parts.length >= 2) {
    const code = parseInt(parts[1], 10);
    if (!isNaN(code)) return code;
  }
  return null;
}

// GET: 학생 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.students();
    const student = await col.findOne({ studentId });

    if (!student) {
      // 학생이 없으면 기본 프로필 반환 (아직 등록 안 됨)
      return NextResponse.json({ 
        exists: false,
        student: null,
        message: '아직 등록된 학생이 없어요. 이름을 알려줘! 🐰'
      });
    }

    return NextResponse.json({ 
      exists: true,
      student 
    });
  } catch (error) {
    console.error('[students/GET] Error:', error);
    return NextResponse.json({ error: '학생 정보 조회 실패' }, { status: 500 });
  }
}

// POST: 학생 프로필 생성/수정
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, name, nickname, grade, school, preferredSubjects, weakSubjects } = body;

    if (!studentId || !name) {
      return NextResponse.json({ error: 'studentId와 name이 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.students();
    const now = new Date();
    
    // 🤖 AI 에이전트: studentId에서 학년 코드 자동 추출
    // 예: "586694_481" → 481 → "고2"
    const gradeCode = extractGradeCodeFromStudentId(studentId);
    const autoGrade = gradeCode ? getGradeFromCode(gradeCode) : null;

    // 이미 존재하면 업데이트, 없으면 생성
    const existingStudent = await col.findOne({ studentId });

    if (existingStudent) {
      // 업데이트
      await col.updateOne(
        { studentId },
        {
          $set: {
            name,
            nickname: nickname || createNickname(name),
            grade: grade || autoGrade || existingStudent.grade,
            school: school || existingStudent.school,
            preferredSubjects: preferredSubjects || existingStudent.preferredSubjects,
            weakSubjects: weakSubjects || existingStudent.weakSubjects,
            updatedAt: now,
          },
        }
      );

      const updated = await col.findOne({ studentId });
      return NextResponse.json({ 
        success: true, 
        student: updated,
        message: `${name}! 프로필이 업데이트됐어 🐰✨`
      });
    } else {
      // 새로 생성
      const newStudent: Student = {
        studentId,
        name,
        nickname: nickname || createNickname(name),
        grade: (grade || autoGrade || '중1') as any,
        school,
        preferredSubjects: preferredSubjects || [],
        weakSubjects: weakSubjects || [],
        agentMemory: {
          recentTopics: [],
          frequentMistakes: [],
          strengths: [],
          totalSessions: 0,
        },
        createdAt: now,
        updatedAt: now,
      };

      const result = await col.insertOne(newStudent as any);
      const created = await col.findOne({ _id: result.insertedId });

      return NextResponse.json({ 
        success: true, 
        student: created,
        message: `반가워 ${name}! 앞으로 잘 부탁해 🐰✨`
      });
    }
  } catch (error) {
    console.error('[students/POST] Error:', error);
    return NextResponse.json({ error: '학생 프로필 저장 실패' }, { status: 500 });
  }
}

// PATCH: 에이전트 메모리 업데이트 (학습 이력)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, agentMemory, addTopic, addMistake, addStrength } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'studentId가 필요합니다.' }, { status: 400 });
    }

    const col = await Collections.students();
    const student = await col.findOne({ studentId });

    if (!student) {
      return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updates: any = { updatedAt: new Date() };

    // 전체 메모리 교체
    if (agentMemory) {
      updates['agentMemory'] = agentMemory;
    }

    // 개별 항목 추가
    const pushUpdates: any = {};

    if (addTopic) {
      // 최근 주제는 최대 10개만 유지
      const recentTopics = student.agentMemory?.recentTopics || [];
      if (!recentTopics.includes(addTopic)) {
        const newTopics = [addTopic, ...recentTopics].slice(0, 10);
        updates['agentMemory.recentTopics'] = newTopics;
      }
    }

    if (addMistake) {
      const frequentMistakes = student.agentMemory?.frequentMistakes || [];
      if (!frequentMistakes.includes(addMistake)) {
        const newMistakes = [addMistake, ...frequentMistakes].slice(0, 20);
        updates['agentMemory.frequentMistakes'] = newMistakes;
      }
    }

    if (addStrength) {
      const strengths = student.agentMemory?.strengths || [];
      if (!strengths.includes(addStrength)) {
        const newStrengths = [addStrength, ...strengths].slice(0, 10);
        updates['agentMemory.strengths'] = newStrengths;
      }
    }

    // 세션 수 증가
    updates['agentMemory.lastSessionAt'] = new Date();
    updates['agentMemory.totalSessions'] = (student.agentMemory?.totalSessions || 0) + 1;

    await col.updateOne({ studentId }, { $set: updates });

    const updated = await col.findOne({ studentId });
    return NextResponse.json({ success: true, student: updated });
  } catch (error) {
    console.error('[students/PATCH] Error:', error);
    return NextResponse.json({ error: '에이전트 메모리 업데이트 실패' }, { status: 500 });
  }
}

