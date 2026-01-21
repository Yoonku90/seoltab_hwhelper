/**
 * 🤖 AI Agent - 정답 평가 및 오답 생성 시스템
 * 
 * 기능:
 * 1. 매력적인 오답 생성 (Distractor Generation)
 * 2. 심층적 정답 평가 (Semantic Evaluation)
 * 3. 상황별 선택지 생성
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { generateWithLimiter } from '@/lib/gemini-rate-limiter';

// 안전 설정
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * 문제 유형
 */
export type QuestionType = 'concept' | 'multiple_choice' | 'short_answer' | 'subjective';

/**
 * 정답 평가 결과
 */
export interface EvaluationResult {
  isCorrect: boolean;
  confidence: number; // 0-1, AI의 확신도
  feedback: string; // 학생에게 줄 피드백
  partialCredit?: number; // 0-100, 부분 점수 (주관식용)
  explanation?: string; // 왜 맞거나 틀렸는지 설명
  suggestedFollowUp?: string; // 후속 질문 제안
}

/**
 * 선택지 생성 결과
 */
export interface ChoicesResult {
  choices: string[];
  correctIndex: number;
  distractorReasons?: string[]; // 각 오답이 왜 매력적인지
}

/**
 * 과목별 오답 생성 전략
 */
const DISTRACTOR_STRATEGIES: Record<string, string> = {
  '수학': `
    - 계산 실수: 부호 오류, 괄호 처리 실수
    - 공식 혼동: 비슷한 공식 적용 실수
    - 조건 누락: 문제 조건 일부 무시
    - 단위 오류: 단위 변환 실수
  `,
  '영어': `
    - 문법 혼동: 비슷한 문법 규칙 혼동 (현재완료 vs 과거, 감각동사 vs 일반동사)
    - 품사 혼동: 형용사 vs 부사, 명사 vs 동사
    - 시제 오류: 시제 일치 실수
    - 어휘 혼동: 비슷한 의미/발음 단어
  `,
  '국어': `
    - 개념 혼동: 화자 vs 시인, 시점 혼동
    - 표현법 혼동: 직유 vs 은유, 역설 vs 반어
    - 문맥 오해: 문맥 파악 실수
    - 문법 혼동: 품사, 어미 구분 실수
  `,
  '과학': `
    - 법칙 혼동: 비슷한 법칙/공식 혼동
    - 단위 오류: 단위 변환 실수
    - 조건 무시: 실험 조건 누락
    - 인과 혼동: 원인과 결과 뒤바꿈
  `,
  '사회': `
    - 제도 혼동: 비슷한 제도/정책 혼동
    - 인물 혼동: 비슷한 시대/역할 인물
    - 연도 혼동: 비슷한 시기 사건
    - 개념 혼동: 비슷한 개념 구분 실수
  `,
};

/**
 * 🎯 매력적인 오답 생성
 * 
 * @param question - 문제 텍스트
 * @param correctAnswer - 정답
 * @param subject - 과목
 * @param numChoices - 선택지 개수 (기본 4개)
 * @param existingChoices - 원본 선택지 (있으면 그대로 사용)
 */
export async function generateDistractors(
  question: string,
  correctAnswer: string,
  subject: string,
  numChoices: number = 4,
  existingChoices?: string[]
): Promise<ChoicesResult> {
  // 원본 선택지가 있으면 그대로 사용
  if (existingChoices && existingChoices.length >= 2) {
    const correctIndex = existingChoices.findIndex(
      c => c.toLowerCase().includes(correctAnswer.toLowerCase()) || 
           correctAnswer.toLowerCase().includes(c.toLowerCase())
    );
    return {
      choices: existingChoices,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
    };
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    // API 키 없으면 단순 생성
    return {
      choices: [correctAnswer, '오답1', '오답2', '오답3'].slice(0, numChoices),
      correctIndex: 0,
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    safetySettings,
  });

  const strategy = DISTRACTOR_STRATEGIES[subject] || DISTRACTOR_STRATEGIES['수학'];

  const prompt = `
너는 교육 전문가야. 학생들이 실제로 헷갈릴 만한 "매력적인 오답"을 생성해줘.

[문제]
${question}

[정답]
${correctAnswer}

[과목]
${subject}

[오답 생성 전략]
${strategy}

[요구사항]
1. 정답 1개 + 오답 ${numChoices - 1}개 = 총 ${numChoices}개 선택지 생성
2. 오답은 학생들이 실제로 실수할 만한 "매력적인" 오답으로
3. 너무 명백한 오답은 피해 (학습 효과 없음)
4. 선택지 순서는 랜덤하게 섞어줘

[출력 형식 - JSON만]
{
  "choices": ["선택지1", "선택지2", "선택지3", "선택지4"],
  "correctIndex": 정답의_인덱스(0부터),
  "distractorReasons": ["오답1이 매력적인 이유", "오답2가 매력적인 이유", ...]
}
`.trim();

  try {
    const result = await generateWithLimiter(model, prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        choices: parsed.choices || [correctAnswer],
        correctIndex: parsed.correctIndex || 0,
        distractorReasons: parsed.distractorReasons,
      };
    }
  } catch (error) {
    console.error('[generateDistractors] Error:', error);
  }

  // 실패 시 기본값
  return {
    choices: [correctAnswer, '오답1', '오답2', '오답3'].slice(0, numChoices),
    correctIndex: 0,
  };
}

/**
 * 🎯 심층적 정답 평가 (Semantic Evaluation)
 * 
 * 단순 텍스트 비교가 아닌, AI가 의미론적으로 정답 여부를 판단
 * 
 * @param question - 문제 텍스트
 * @param expectedAnswer - 예상 정답
 * @param studentAnswer - 학생 답변
 * @param subject - 과목
 * @param context - 추가 컨텍스트 (문제 조건 등)
 */
export async function evaluateAnswer(
  question: string,
  expectedAnswer: string,
  studentAnswer: string,
  subject: string,
  context?: string
): Promise<EvaluationResult> {
  // 빈 답변 체크
  if (!studentAnswer || studentAnswer.trim() === '') {
    return {
      isCorrect: false,
      confidence: 1,
      feedback: '답을 입력해줘! 🐰',
    };
  }

  // 1차: 단순 비교 (정확히 일치하면 바로 정답)
  const normalizedExpected = normalizeAnswer(expectedAnswer);
  const normalizedStudent = normalizeAnswer(studentAnswer);
  
  if (normalizedExpected === normalizedStudent) {
    return {
      isCorrect: true,
      confidence: 1,
      feedback: '딩동댕! 정확해! 🐰✨',
      partialCredit: 100,
    };
  }

  // 2차: AI 심층 평가
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    // API 키 없으면 단순 비교
    return {
      isCorrect: false,
      confidence: 0.5,
      feedback: '음... 다시 한번 생각해볼까? 🐰',
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-pro',
    safetySettings,
  });

  const prompt = `
너는 ${subject} 선생님이야. 학생의 답이 맞는지 **심층적으로** 판단해줘.

[문제]
${question}

[예상 정답]
${expectedAnswer}

[학생 답변]
${studentAnswer}

${context ? `[추가 컨텍스트/조건]\n${context}` : ''}

[판단 기준]
1. **의미가 같으면 정답으로 인정해** (표현 방식, 띄어쓰기, 대소문자 차이는 무시)
   - 예: "감각동사" = "감각 동사" = "sensory verb" → 정답
   - 예: "a=1, b=-2" = "a는 1이고 b는 -2" = "1, -2" → 정답
2. **부분적으로 맞으면 부분 점수**
   - 예: "a=1"만 맞추고 "b=-2"를 틀렸으면 → 50점
3. **과목별 특수 규칙**:
   - 수학: 수식 형태가 달라도 값이 같으면 정답 ($\\frac{1}{2}$ = 0.5)
   - 영어: 같은 의미의 다른 표현 허용 (약간의 문법 오류는 부분 점수)
   - 국어: 핵심 키워드가 포함되면 정답으로 인정
4. **문제의 조건을 반드시 고려해** (문제에서 특정 형식을 요구하면 그 형식 확인)

[출력 형식 - JSON만]
{
  "isCorrect": true/false,
  "confidence": 0.0~1.0,
  "partialCredit": 0~100,
  "feedback": "학생에게 줄 피드백 (반말, 친절하게)",
  "explanation": "왜 맞거나 틀렸는지 설명",
  "suggestedFollowUp": "후속 질문 또는 힌트 (틀렸을 때)"
}
`.trim();

  try {
    const result = await generateWithLimiter(model, prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: parsed.isCorrect ?? false,
        confidence: parsed.confidence ?? 0.5,
        feedback: parsed.feedback || (parsed.isCorrect ? '맞았어! 🐰' : '아깝다! 다시 해볼까? 🐰'),
        partialCredit: parsed.partialCredit,
        explanation: parsed.explanation,
        suggestedFollowUp: parsed.suggestedFollowUp,
      };
    }
  } catch (error) {
    console.error('[evaluateAnswer] Error:', error);
  }

  // 실패 시 기본값
  return {
    isCorrect: false,
    confidence: 0.3,
    feedback: '음... 다시 한번 생각해볼까? 🐰',
  };
}

/**
 * 답변 정규화 (공백, 대소문자, 특수문자 처리)
 */
function normalizeAnswer(answer: string): string {
  return answer
    .toLowerCase()
    .replace(/\s+/g, '') // 모든 공백 제거
    .replace(/[.,;:!?'"()[\]{}]/g, '') // 구두점 제거
    .replace(/[=＝]/g, '=') // 등호 통일
    .replace(/[−–—]/g, '-') // 마이너스 통일
    .trim();
}

/**
 * 🎯 문제 유형 분석
 * 
 * @param question - 문제 텍스트
 * @param choices - 선택지 (있으면)
 */
export function analyzeQuestionType(
  question: string,
  choices?: string[]
): QuestionType {
  // 선택지가 있으면 객관식
  if (choices && choices.length >= 2) {
    return 'multiple_choice';
  }

  // 키워드로 판단
  const q = question.toLowerCase();
  
  // 개념 확인 문제 (O/X, 맞다/틀리다)
  if (
    q.includes('맞으면') || q.includes('틀리면') ||
    q.includes('o/x') || q.includes('○/×') ||
    q.includes('옳은 것') || q.includes('옳지 않은 것')
  ) {
    return 'concept';
  }

  // 주관식 (서술형)
  if (
    q.includes('서술하') || q.includes('설명하') ||
    q.includes('이유를') || q.includes('근거를')
  ) {
    return 'subjective';
  }

  // 단답형
  return 'short_answer';
}

/**
 * 🎯 상황별 선택지 개수 결정
 */
export function determineChoiceCount(
  questionType: QuestionType,
  stage: 'concept' | 'practice' | 'quiz'
): number {
  if (questionType === 'concept') {
    return 2; // 기본 개념: O/X 또는 A/B
  }
  
  if (questionType === 'short_answer' || questionType === 'subjective') {
    return 0; // 주관식: 직접 입력
  }

  // 객관식
  if (stage === 'concept') {
    return 2; // 개념 확인: 2개
  } else if (stage === 'practice') {
    return 4; // 연습 문제: 4개
  } else {
    return 4; // 퀴즈: 4개
  }
}

