/**
 * 테스트 데이터 정리 스크립트
 * 
 * 실행 방법:
 * npx ts-node --compiler-options '{"module":"commonjs"}' scripts/clear-test-data.ts
 * 
 * 또는 package.json에 스크립트 추가 후:
 * npm run clear-test-data
 */

import { MongoClient } from 'mongodb';

async function clearTestData() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.');
    console.log('   .env.local 파일에 MONGODB_URI를 설정해주세요.');
    process.exit(1);
  }

  console.log('🔗 MongoDB 연결 중...');
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('\n📊 현재 데이터 현황:');
    
    // 각 컬렉션의 데이터 수 확인
    const collections = [
      'students',
      'review_programs',
      'image_uploads',
      'assignments',
      'problems',
      'attempts',
      'help_sessions',
      'ai_tutor_sessions',
      'learning_events',
    ];
    
    for (const name of collections) {
      const col = db.collection(name);
      const count = await col.countDocuments();
      if (count > 0) {
        console.log(`   - ${name}: ${count}개`);
      }
    }
    
    console.log('\n🗑️  테스트 데이터 삭제 중...');
    
    // 모든 컬렉션 삭제
    for (const name of collections) {
      const col = db.collection(name);
      const result = await col.deleteMany({});
      if (result.deletedCount > 0) {
        console.log(`   ✅ ${name}: ${result.deletedCount}개 삭제됨`);
      }
    }
    
    console.log('\n✨ 테스트 데이터 정리 완료!');
    console.log('   이제 깨끗한 상태에서 시작할 수 있어요 🐰');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    await client.close();
  }
}

// 실행
clearTestData();



