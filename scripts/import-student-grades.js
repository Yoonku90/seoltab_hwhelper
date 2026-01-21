const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const CSV_PATH = path.resolve(
  process.cwd(),
  'data',
  'students.csv'
);

const ENV_PATH = path.resolve(process.cwd(), '.env.local');

const YEAR_TO_GRADE = {
  484: 'N수생',
  483: '일반인',
  482: '고3',
  481: '고2',
  480: '고1',
  479: '중3',
  478: '중2',
  477: '중1',
};

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return;
  const content = fs.readFileSync(ENV_PATH, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (!key || rest.length === 0) continue;
    const value = rest.join('=').trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
}

function parseCsv(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const idxUserNo = headers.findIndex((h) => h === 's_user_no' || h === 'user_no');
  const idxYear = headers.findIndex((h) => h === 'year');

  if (idxUserNo === -1) {
    throw new Error('CSV에 s_user_no 컬럼이 없습니다.');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const userNo = values[idxUserNo];
    if (!userNo) continue;
    const yearValue = idxYear >= 0 ? values[idxYear] : '';
    const year = yearValue ? Number(yearValue) : null;
    const grade = Number.isFinite(year) ? (YEAR_TO_GRADE[year] || String(year)) : null;

    rows.push({
      userNo: String(userNo),
      year: Number.isFinite(year) ? year : null,
      grade,
    });
  }

  return rows;
}

async function run() {
  loadEnvFile();

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI 환경 변수가 없습니다. .env.local을 확인하세요.');
  }

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV 파일이 없습니다: ${CSV_PATH}`);
  }

  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csvContent);
  if (rows.length === 0) {
    console.log('CSV 데이터가 없습니다. 종료합니다.');
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db();
  const collection = db.collection('student_grade_mappings');

  const ops = rows.map((row) => ({
    updateOne: {
      filter: { userNo: row.userNo },
      update: {
        $set: {
          userNo: row.userNo,
          year: row.year,
          grade: row.grade,
          updatedAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result = await collection.bulkWrite(ops, { ordered: false });
  const count = await collection.countDocuments();

  console.log(`업로드 완료: ${rows.length}행 처리`);
  console.log(`Mongo 저장 결과: matched=${result.matchedCount}, upserted=${result.upsertedCount}, modified=${result.modifiedCount}`);
  console.log(`student_grade_mappings 총 ${count}건`);

  await client.close();
}

run().catch((err) => {
  console.error('업로드 실패:', err);
  process.exit(1);
});

