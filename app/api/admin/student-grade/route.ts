import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getDb } from '@/lib/db';

type CsvStatus = {
  exists: boolean;
  path: string;
  rowCount: number;
  headers: string[];
  mongoCount?: number;
  updatedAt?: string;
  missingColumns?: string[];
};

const REQUIRED_HEADERS = ['s_user_no'];

function resolveCsvPath(): string {
  const configuredPath =
    process.env.STUDENT_SPREADSHEET_PATH || './data/students.csv';
  return path.resolve(process.cwd(), configuredPath);
}

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

function parseCsvStatus(content: string, filePath: string, updatedAt?: Date): CsvStatus {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      exists: true,
      path: filePath,
      rowCount: 0,
      headers: [],
      updatedAt: updatedAt?.toISOString(),
      missingColumns: REQUIRED_HEADERS,
    };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const rowCount = Math.max(0, lines.length - 1);
  const missingColumns = REQUIRED_HEADERS.filter((h) => !headers.includes(h));

  return {
    exists: true,
    path: filePath,
    rowCount,
    headers,
    updatedAt: updatedAt?.toISOString(),
    missingColumns: missingColumns.length > 0 ? missingColumns : undefined,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    const mongoCount = await db.collection('student_grade_mappings').countDocuments();
    const csvPath = resolveCsvPath();
    const stat = await fs.stat(csvPath).catch(() => null);

    if (!stat) {
      return NextResponse.json({
        exists: false,
        path: csvPath,
        rowCount: 0,
        headers: [],
        mongoCount,
      } satisfies CsvStatus);
    }

    const content = await fs.readFile(csvPath, 'utf-8');
    const status = parseCsvStatus(content, csvPath, stat.mtime);

    return NextResponse.json(status);
  } catch (error) {
    console.error('[admin/student-grade GET] Error:', error);
    return NextResponse.json({ error: 'CSV 상태 조회 실패' }, { status: 500 });
  }
}

type ParsedRow = {
  userNo: string;
  year?: number | null;
  grade?: string | null;
};

function parseCsvRows(content: string): { rows: ParsedRow[]; headers: string[] } {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], headers: [] };
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const idxUserNo = headers.findIndex((h) => h === 's_user_no' || h === 'user_no');
  const idxYear = headers.findIndex((h) => h === 'year');
  const idxGrade = headers.findIndex((h) => h === 'grade');

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const userNo = values[idxUserNo] ? String(values[idxUserNo]) : '';
    if (!userNo) continue;
    const yearValue = idxYear >= 0 ? values[idxYear] : undefined;
    const gradeValue = idxGrade >= 0 ? values[idxGrade] : undefined;
    const year = yearValue ? Number(yearValue) : undefined;
    const grade = gradeValue ? gradeValue : mapYearToGrade(yearValue);

    rows.push({
      userNo,
      year: Number.isFinite(year) ? year : undefined,
      grade,
    });
  }

  return { rows, headers };
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'CSV 파일이 필요합니다.' }, { status: 400 });
    }

    const csvPath = resolveCsvPath();
    await fs.mkdir(path.dirname(csvPath), { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: '빈 파일은 업로드할 수 없습니다.' }, { status: 400 });
    }

    await fs.writeFile(csvPath, buffer);

    const content = buffer.toString('utf-8');
    const { rows, headers } = parseCsvRows(content);
    const status = parseCsvStatus(content, csvPath, new Date());

    if (rows.length > 0) {
      const bulkOps = rows.map((row) => ({
        updateOne: {
          filter: { userNo: row.userNo },
          update: {
            $set: {
              userNo: row.userNo,
              year: row.year ?? null,
              grade: row.grade ?? null,
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      await db.collection('student_grade_mappings').bulkWrite(bulkOps, { ordered: false });
    }

    const mongoCount = await db.collection('student_grade_mappings').countDocuments();

    return NextResponse.json({
      success: true,
      ...status,
      headers,
      mongoCount,
      importedRows: rows.length,
    });
  } catch (error) {
    console.error('[admin/student-grade POST] Error:', error);
    return NextResponse.json({ error: 'CSV 업로드 실패' }, { status: 500 });
  }
}

