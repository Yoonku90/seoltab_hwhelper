// ==========================================
// 🧪 AI Agent APIs 테스트 스크립트
// ==========================================

/**
 * 사용법:
 * npx tsx scripts/test-agent-apis.ts
 * 
 * 또는 Node.js로 직접 실행:
 * node --loader ts-node/esm scripts/test-agent-apis.ts
 */

// 환경 변수 로드 (.env.local)
import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local 파일 로드
config({ path: resolve(process.cwd(), '.env.local') });
// .env 파일도 시도 (없으면 무시)
config({ path: resolve(process.cwd(), '.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// 테스트용 학생 ID
const TEST_STUDENT_ID = '111111_481'; // 고2 학생
const TEST_GRADE = '고2';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * 1. Event Collector 테스트 (학습 이벤트 수집)
 */
async function testEventCollector(): Promise<TestResult> {
  try {
    console.log('\n📝 [1] Event Collector 테스트...');
    
    const event = {
      studentId: TEST_STUDENT_ID,
      reviewProgramId: 'test-review-id',
      eventType: 'concept_learned',
      metadata: {
        subject: '영어',
        topic: '감각동사',
        difficulty: 3,
        timeSpent: 300, // 5분
        score: 85,
      },
    };
    
    const response = await fetch(`${API_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { name: 'Event Collector', success: false, error };
    }
    
    const data = await response.json();
    console.log('✅ Event Collector 성공:', data);
    
    return { name: 'Event Collector', success: true, data };
  } catch (error: any) {
    return { name: 'Event Collector', success: false, error: error.message };
  }
}

/**
 * 2. Memory Update API 테스트 (agentMemory 업데이트)
 */
async function testMemoryUpdate(): Promise<TestResult> {
  try {
    console.log('\n🧠 [2] Memory Update API 테스트...');
    
    const response = await fetch(`${API_BASE_URL}/api/agent/memory/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: TEST_STUDENT_ID }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return { name: 'Memory Update', success: false, error };
    }
    
    const data = await response.json();
    console.log('✅ Memory Update 성공:', data);
    
    return { name: 'Memory Update', success: true, data };
  } catch (error: any) {
    return { name: 'Memory Update', success: false, error: error.message };
  }
}

/**
 * 3. Student Profile 조회 테스트 (agentMemory 확인)
 */
async function testStudentProfile(): Promise<TestResult> {
  try {
    console.log('\n👤 [3] Student Profile 조회 테스트...');
    
    const response = await fetch(`${API_BASE_URL}/api/students?studentId=${TEST_STUDENT_ID}`);
    
    if (!response.ok) {
      const error = await response.text();
      return { name: 'Student Profile', success: false, error };
    }
    
    const data = await response.json();
    console.log('✅ Student Profile 조회 성공');
    console.log('   - 이름:', data.student?.name);
    console.log('   - 학년:', data.student?.grade);
    console.log('   - 총 세션:', data.student?.agentMemory?.totalSessions || 0);
    console.log('   - 최근 주제:', data.student?.agentMemory?.recentTopics?.slice(0, 3) || []);
    console.log('   - 자주 틀리는 유형:', data.student?.agentMemory?.frequentMistakes?.slice(0, 3) || []);
    console.log('   - 강점:', data.student?.agentMemory?.strengths?.slice(0, 3) || []);
    console.log('   - 평균 점수:', data.student?.agentMemory?.averageScore || 'N/A');
    
    return { name: 'Student Profile', success: true, data: data.student };
  } catch (error: any) {
    return { name: 'Student Profile', success: false, error: error.message };
  }
}

/**
 * 4. Pattern Analyzer 테스트 (패턴 분석)
 */
async function testPatternAnalyzer(): Promise<TestResult> {
  try {
    console.log('\n🔍 [4] Pattern Analyzer 테스트...');
    
    // 환경 변수 확인
    if (!process.env.MONGODB_URI) {
      return { 
        name: 'Pattern Analyzer', 
        success: false, 
        error: 'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' 
      };
    }
    
    // 직접 함수 호출 (API가 없다면)
    const { analyzeLearningPattern } = await import('../lib/agent/analyzer/pattern-analyzer');
    const analysis = await analyzeLearningPattern(TEST_STUDENT_ID);
    
    console.log('✅ Pattern Analyzer 성공');
    console.log('   - 성능 추세:', analysis.performanceTrend);
    console.log('   - 학습 효율:', (analysis.learningEfficiency * 100).toFixed(1) + '%');
    console.log('   - 실수 패턴:', analysis.mistakePatterns.slice(0, 3));
    console.log('   - 추천:', analysis.recommendations);
    
    return { name: 'Pattern Analyzer', success: true, data: analysis };
  } catch (error: any) {
    return { name: 'Pattern Analyzer', success: false, error: error.message };
  }
}

/**
 * 5. Adaptive Engine 테스트 (적응형 학습 계획)
 */
async function testAdaptiveEngine(): Promise<TestResult> {
  try {
    console.log('\n🎯 [5] Adaptive Engine 테스트...');
    
    // 환경 변수 확인
    if (!process.env.MONGODB_URI) {
      return { 
        name: 'Adaptive Engine', 
        success: false, 
        error: 'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' 
      };
    }
    
    const { generateAdaptivePlan } = await import('../lib/agent/adaptive/engine');
    const plan = await generateAdaptivePlan(TEST_STUDENT_ID, TEST_GRADE as any, '영어');
    
    console.log('✅ Adaptive Engine 성공');
    console.log('   - 학습 속도:', plan.pace);
    console.log('   - 현재 수준:', plan.currentLevel);
    console.log('   - 학습 경로:', plan.learningPath.slice(0, 3));
    
    return { name: 'Adaptive Engine', success: true, data: plan };
  } catch (error: any) {
    return { name: 'Adaptive Engine', success: false, error: error.message };
  }
}

/**
 * 6. Prediction Model 테스트 (예측 모델)
 */
async function testPredictionModel(): Promise<TestResult> {
  try {
    console.log('\n🔮 [6] Prediction Model 테스트...');
    
    // 환경 변수 확인
    if (!process.env.MONGODB_URI) {
      return { 
        name: 'Prediction Model', 
        success: false, 
        error: 'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' 
      };
    }
    
    const { predictPerformance } = await import('../lib/agent/prediction/predictor');
    const prediction = await predictPerformance(TEST_STUDENT_ID, '영어');
    
    console.log('✅ Prediction Model 성공');
    console.log('   - 예상 점수:', prediction.predictedScore.toFixed(1));
    console.log('   - 신뢰도:', (prediction.confidence * 100).toFixed(1) + '%');
    console.log('   - 약점 영역:', prediction.weakAreas.slice(0, 3));
    console.log('   - 추천 액션:', prediction.recommendedActions);
    
    return { name: 'Prediction Model', success: true, data: prediction };
  } catch (error: any) {
    return { name: 'Prediction Model', success: false, error: error.message };
  }
}

/**
 * 7. Intervention System 테스트 (개입 시스템)
 */
async function testInterventionSystem(): Promise<TestResult> {
  try {
    console.log('\n🚨 [7] Intervention System 테스트...');
    
    // 환경 변수 확인
    if (!process.env.MONGODB_URI) {
      return { 
        name: 'Intervention System', 
        success: false, 
        error: 'MONGODB_URI 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' 
      };
    }
    
    const { checkAndGenerateIntervention } = await import('../lib/agent/prediction/intervention');
    const intervention = await checkAndGenerateIntervention(TEST_STUDENT_ID, '영어');
    
    if (intervention) {
      console.log('✅ Intervention System - 개입 필요');
      console.log('   - 액션:', intervention.action);
      console.log('   - 우선순위:', intervention.priority);
      console.log('   - 이유:', intervention.reason);
      console.log('   - 메시지:', intervention.message);
    } else {
      console.log('✅ Intervention System - 개입 불필요');
    }
    
    return { name: 'Intervention System', success: true, data: intervention };
  } catch (error: any) {
    return { name: 'Intervention System', success: false, error: error.message };
  }
}

/**
 * 테스트 학생 생성 (없으면 생성)
 */
async function ensureTestStudent(): Promise<boolean> {
  try {
    console.log('\n👤 테스트 학생 확인 중...');
    
    // 학생 존재 확인
    const checkRes = await fetch(`${API_BASE_URL}/api/students?studentId=${TEST_STUDENT_ID}`);
    const checkData = await checkRes.json();
    
    if (checkData.exists && checkData.student) {
      console.log(`✅ 테스트 학생 존재함: ${checkData.student.name || TEST_STUDENT_ID}`);
      return true;
    }
    
    // 학생 생성
    console.log('📝 테스트 학생 생성 중...');
    const createRes = await fetch(`${API_BASE_URL}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: TEST_STUDENT_ID,
        name: '테스트',
        grade: TEST_GRADE,
      }),
    });
    
    if (!createRes.ok) {
      const error = await createRes.text();
      console.log(`⚠️  학생 생성 실패: ${error}`);
      return false;
    }
    
    const createData = await createRes.json();
    console.log(`✅ 테스트 학생 생성 완료: ${createData.student?.name || TEST_STUDENT_ID}`);
    return true;
  } catch (error: any) {
    console.log(`⚠️  학생 확인/생성 중 오류: ${error.message}`);
    return false;
  }
}

/**
 * 메인 테스트 실행
 */
async function runTests() {
  console.log('🧪 AI Agent APIs 테스트 시작...');
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log(`👤 테스트 학생 ID: ${TEST_STUDENT_ID}`);
  console.log('='.repeat(50));
  
  // 테스트 학생 확인 및 생성
  const studentReady = await ensureTestStudent();
  if (!studentReady) {
    console.log('\n⚠️  경고: 테스트 학생 생성에 실패했습니다.');
    console.log('   일부 테스트가 실패할 수 있습니다.');
    console.log('   수동으로 학생을 생성하려면:');
    console.log(`   curl -X POST ${API_BASE_URL}/api/students \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"studentId": "${TEST_STUDENT_ID}", "name": "테스트", "grade": "${TEST_GRADE}"}'`);
    console.log('');
  }
  
  const results: TestResult[] = [];
  
  // 1. Event Collector
  results.push(await testEventCollector());
  
  // 2. Memory Update (이벤트 후 업데이트)
  results.push(await testMemoryUpdate());
  
  // 3. Student Profile
  results.push(await testStudentProfile());
  
  // 4. Pattern Analyzer
  results.push(await testPatternAnalyzer());
  
  // 5. Adaptive Engine
  results.push(await testAdaptiveEngine());
  
  // 6. Prediction Model
  results.push(await testPredictionModel());
  
  // 7. Intervention System
  results.push(await testInterventionSystem());
  
  // 결과 요약
  console.log('\n' + '='.repeat(50));
  console.log('📊 테스트 결과 요약:');
  console.log('='.repeat(50));
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    if (!result.success && result.error) {
      console.log(`   ⚠️  에러: ${result.error}`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ 성공: ${successCount}개`);
  console.log(`❌ 실패: ${failCount}개`);
  console.log('='.repeat(50));
  
  if (failCount > 0) {
    console.log('\n⚠️  일부 테스트가 실패했습니다. 서버가 실행 중인지 확인하세요.');
    console.log('   실행 방법: npm run dev');
  } else {
    console.log('\n🎉 모든 테스트가 성공했습니다!');
  }
}

// 스크립트 실행
// tsx로 실행할 때 자동 실행
runTests().catch(console.error);

export { runTests };

