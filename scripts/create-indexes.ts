// MongoDB 인덱스 생성 스크립트
// 실행: npx tsx scripts/create-indexes.ts

import { createIndexes } from '../lib/db';

async function main() {
  try {
    console.log('MongoDB 인덱스 생성을 시작합니다...');
    await createIndexes();
    console.log('인덱스 생성이 완료되었습니다!');
    process.exit(0);
  } catch (error) {
    console.error('인덱스 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

main();

