/**
 * 스프레드시트 데이터를 사용한 학생 학년 자동 매칭
 */

export interface StudentRecord {
  s_user_no: string | number;
  s_user_name?: string;
  year?: string | number;
  grade: string; // "고3", "고2", "중3", "N수생" 등
}

let studentCache: Map<string, StudentRecord> | null = null;
let cacheLoadTime: number = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1시간

function mapYearToGrade(yearValue?: string | number | null): string | null {
  if (yearValue === null || yearValue === undefined) return null;
  const year = Number(yearValue);
  if (!Number.isFinite(year)) return null;
  const mapping: Record<number, string> = {
    484: 'N수생',
    483: '일반인',
    482: '고3',
    481: '고2',
    480: '고1',
    479: '중3',
    478: '중2',
    477: '중1',
  };
  return mapping[year] || String(year);
}

async function loadFromMongo(): Promise<Map<string, StudentRecord> | null> {
  try {
    const { getDb } = await import('./db');
    const db = await getDb();
    const rows = await db.collection('student_grade_mappings').find({}).toArray();
    if (!rows || rows.length === 0) return null;

    const map = new Map<string, StudentRecord>();
    for (const row of rows) {
      if (!row.userNo) continue;
      map.set(String(row.userNo), {
        s_user_no: row.userNo,
        grade: row.grade || mapYearToGrade(row.year) || '',
        year: row.year ?? undefined,
      });
    }
    return map;
  } catch (error) {
    console.warn('[student-grade-matcher] Mongo 로드 실패, CSV로 fallback');
    return null;
  }
}

/**
 * 스프레드시트 데이터 로드 (CSV 또는 JSON)
 */
async function loadStudentData(): Promise<Map<string, StudentRecord>> {
  // 캐시 확인
  const now = Date.now();
  if (studentCache && now - cacheLoadTime < CACHE_TTL) {
    return studentCache;
  }

  try {
    const mongoData = await loadFromMongo();
    if (mongoData && mongoData.size > 0) {
      studentCache = mongoData;
      cacheLoadTime = now;
      return mongoData;
    }

    // 환경 변수에서 스프레드시트 경로 확인
    const spreadsheetPath =
      process.env.STUDENT_SPREADSHEET_PATH ||
      process.env.NEXT_PUBLIC_STUDENT_SPREADSHEET_PATH ||
      './data/students.csv'; // 기본값

    const fs = await import('fs/promises');
    const path = await import('path');

    // JSON 파일이 있으면 JSON 우선 사용
    if (spreadsheetPath.endsWith('.json')) {
      const fullPath = path.resolve(process.cwd(), spreadsheetPath);
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      const data: StudentRecord[] = JSON.parse(fileContent);

      const map = new Map<string, StudentRecord>();
      for (const record of data) {
        const userNo = String(record.s_user_no);
        map.set(userNo, record);
      }

      studentCache = map;
      cacheLoadTime = now;
      return map;
    }

    // CSV 파일 파싱
    if (spreadsheetPath.endsWith('.csv')) {
      const fullPath = path.resolve(process.cwd(), spreadsheetPath);
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      const lines = fileContent.split('\n').filter((line) => line.trim());

      const headers = lines[0].split(',').map((h) => h.trim());
      const userNoIdx = headers.findIndex((h) => h === 's_user_no' || h === 'user_no');
      const userNameIdx = headers.findIndex((h) => h === 's_user_name' || h === 'user_name' || h === 's_uer_name');
      const yearIdx = headers.findIndex((h) => h === 'year');
      const gradeIdx = headers.findIndex((h) => h === 'grade');

      if (userNoIdx === -1) {
        throw new Error('필수 컬럼이 없습니다: s_user_no');
      }

      const map = new Map<string, StudentRecord>();
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim());
        const record: StudentRecord = {
          s_user_no: values[userNoIdx],
          s_user_name: userNameIdx >= 0 ? values[userNameIdx] : undefined,
          grade: '',
        };

        if (yearIdx !== -1) {
          record.year = values[yearIdx];
        }
        if (gradeIdx !== -1 && values[gradeIdx]) {
          record.grade = values[gradeIdx];
        } else {
          record.grade = mapYearToGrade(record.year) || '';
        }

        map.set(String(record.s_user_no), record);
      }

      studentCache = map;
      cacheLoadTime = now;
      return map;
    }

    throw new Error(`지원하지 않는 파일 형식: ${spreadsheetPath}`);
  } catch (error: any) {
    console.error('[student-grade-matcher] 스프레드시트 로드 실패:', error?.message || error);
    
    // 에러 발생 시 빈 Map 반환 (기능 비활성화)
    return new Map();
  }
}

import { getCurrentKSTYear } from './time-utils';

/**
 * 학년을 1년 낮추는 함수 (작년 수업인 경우)
 */
function adjustGradeForPastYear(grade: string): string {
  const gradeMap: Record<string, string> = {
    '고3': '고2',
    '고2': '고1',
    '고1': '중3',
    '중3': '중2',
    '중2': '중1',
    '중1': '중1', // 중1 이하는 변경 없음
  };
  return gradeMap[grade] || grade;
}

/**
 * 유저 번호로 학년 조회
 * @param userNo 유저 번호
 * @param sessionYear 수업 진행 년도 (null이면 현재 년도 기준, KST 기준)
 */
export async function getGradeByUserNo(userNo: string | number, sessionYear?: number | null): Promise<string | null> {
  try {
    const studentData = await loadStudentData();
    const userNoStr = String(userNo);
    const record = studentData.get(userNoStr);

    if (!record || !record.grade) {
      return null;
    }

    let grade = record.grade;

    // N수생은 항상 고3으로 매핑
    if (grade === 'N수생') {
      grade = '고3';
    }

    // 수업 년도가 현재 년도보다 작으면 (작년 수업) 학년을 -1 조정 (KST 기준)
    const currentYear = getCurrentKSTYear();
    if (sessionYear && sessionYear < currentYear) {
      const yearDiff = currentYear - sessionYear;
      if (yearDiff >= 1) {
        // 작년 수업이면 학년을 1년 낮춤
        grade = adjustGradeForPastYear(grade);
        console.log(`[student-grade-matcher] ${sessionYear}년 수업 감지 (KST 기준): ${record.grade} → ${grade} (${yearDiff}년 전, 현재: ${currentYear}년)`);
      }
    }

    return grade;
  } catch (error: any) {
    console.error('[student-grade-matcher] 학년 조회 실패:', error?.message || error);
    return null;
  }
}

/**
 * 유저 번호로 전체 학생 정보 조회
 */
export async function getStudentInfoByUserNo(
  userNo: string | number
): Promise<StudentRecord | null> {
  try {
    const studentData = await loadStudentData();
    const userNoStr = String(userNo);
    return studentData.get(userNoStr) || null;
  } catch (error: any) {
    console.error('[student-grade-matcher] 학생 정보 조회 실패:', error?.message || error);
    return null;
  }
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearStudentCache(): void {
  studentCache = null;
  cacheLoadTime = 0;
}

