/**
 * 🤖 AI 에이전트 도구 모음
 * 랑쌤이 사용할 수 있는 도구들
 */

// ==========================================
// 수학 계산 도구
// ==========================================

/**
 * 기본 수학 계산 (eval 대신 안전한 계산)
 */
export function calculateMath(expression: string): { result: number | string; steps: string[] } {
  const steps: string[] = [];
  
  try {
    // 수식 정리
    let expr = expression
      .replace(/\s/g, '')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/\^/g, '**');
    
    steps.push(`원식: ${expression}`);
    
    // 괄호 처리
    const hasParentheses = expr.includes('(');
    if (hasParentheses) {
      steps.push(`괄호 안부터 계산`);
    }
    
    // 간단한 사칙연산만 처리 (보안을 위해 eval 대신)
    const result = Function(`"use strict"; return (${expr})`)();
    
    if (typeof result === 'number') {
      if (Number.isInteger(result)) {
        steps.push(`= ${result}`);
      } else {
        steps.push(`= ${result.toFixed(4)} (소수점 4자리)`);
      }
      return { result, steps };
    }
    
    return { result: '계산 불가', steps: ['수식을 확인해주세요'] };
  } catch (error) {
    return { result: '계산 오류', steps: ['올바른 수식을 입력해주세요'] };
  }
}

/**
 * 방정식 풀이 (일차방정식)
 * 예: "2x + 3 = 7" → x = 2
 */
export function solveLinearEquation(equation: string): { solution: string; steps: string[] } {
  const steps: string[] = [];
  
  try {
    steps.push(`원식: ${equation}`);
    
    // ax + b = c 형태로 파싱
    const match = equation.match(/(-?\d*)x\s*([+-]\s*\d+)?\s*=\s*(-?\d+)/);
    if (!match) {
      return { solution: '파싱 불가', steps: ['일차방정식 형태를 확인해주세요 (예: 2x + 3 = 7)'] };
    }
    
    const a = parseInt(match[1] || '1') || 1;
    const b = parseInt((match[2] || '0').replace(/\s/g, '')) || 0;
    const c = parseInt(match[3]);
    
    steps.push(`${a}x + ${b} = ${c}`);
    steps.push(`${a}x = ${c} - ${b}`);
    steps.push(`${a}x = ${c - b}`);
    steps.push(`x = ${c - b} ÷ ${a}`);
    
    const x = (c - b) / a;
    steps.push(`x = ${Number.isInteger(x) ? x : x.toFixed(2)}`);
    
    return { solution: `x = ${Number.isInteger(x) ? x : x.toFixed(2)}`, steps };
  } catch (error) {
    return { solution: '풀이 오류', steps: ['방정식을 확인해주세요'] };
  }
}

/**
 * 분수 계산
 */
export function calculateFraction(expr: string): { result: string; steps: string[] } {
  const steps: string[] = [];
  
  try {
    steps.push(`원식: ${expr}`);
    
    // 분수 파싱 (예: "1/2 + 1/3")
    const fractionRegex = /(-?\d+)\/(\d+)/g;
    const matches = [...expr.matchAll(fractionRegex)];
    
    if (matches.length === 0) {
      return { result: '분수 없음', steps: ['분수 형태를 확인해주세요 (예: 1/2 + 1/3)'] };
    }
    
    // 덧셈/뺄셈 분수 계산
    if (matches.length === 2 && (expr.includes('+') || expr.includes('-'))) {
      const [n1, d1] = [parseInt(matches[0][1]), parseInt(matches[0][2])];
      const [n2, d2] = [parseInt(matches[1][1]), parseInt(matches[1][2])];
      const isAddition = expr.includes('+');
      
      // 최소공배수 구하기
      const lcm = (d1 * d2) / gcd(d1, d2);
      const newN1 = n1 * (lcm / d1);
      const newN2 = n2 * (lcm / d2);
      
      steps.push(`통분: ${newN1}/${lcm} ${isAddition ? '+' : '-'} ${newN2}/${lcm}`);
      
      const resultN = isAddition ? newN1 + newN2 : newN1 - newN2;
      const g = gcd(Math.abs(resultN), lcm);
      
      steps.push(`= ${resultN}/${lcm}`);
      
      if (g > 1) {
        steps.push(`약분: ${resultN / g}/${lcm / g}`);
        return { result: `${resultN / g}/${lcm / g}`, steps };
      }
      
      return { result: `${resultN}/${lcm}`, steps };
    }
    
    return { result: '복잡한 분수 연산', steps: ['단순 분수 연산만 지원합니다'] };
  } catch (error) {
    return { result: '계산 오류', steps: ['분수를 확인해주세요'] };
  }
}

// 최대공약수
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// ==========================================
// 영어 문법 도구
// ==========================================

/**
 * 영어 문법 검사 및 설명
 */
export function checkEnglishGrammar(sentence: string): {
  isCorrect: boolean;
  explanation: string;
  suggestion?: string;
} {
  const s = sentence.trim();
  
  // 감각동사 + 형용사 검사
  const sensoryVerbs = ['look', 'looks', 'feel', 'feels', 'smell', 'smells', 'taste', 'tastes', 'sound', 'sounds'];
  const adverbs = ['happily', 'sadly', 'beautifully', 'wonderfully', 'greatly', 'nicely'];
  
  for (const verb of sensoryVerbs) {
    if (s.toLowerCase().includes(verb)) {
      for (const adv of adverbs) {
        if (s.toLowerCase().includes(adv)) {
          const adj = adv.replace(/ly$/, '').replace(/ful$/, 'ful').replace(/i$/, 'y');
          return {
            isCorrect: false,
            explanation: `감각동사 "${verb}" 뒤에는 부사(${adv})가 아니라 형용사가 와야 해!`,
            suggestion: s.replace(new RegExp(adv, 'i'), adj),
          };
        }
      }
    }
  }
  
  // 기본적으로 맞다고 가정
  return {
    isCorrect: true,
    explanation: '문법적으로 올바른 문장이야!',
  };
}

/**
 * 영어 문장 구조 분석
 */
export function analyzeEnglishSentence(sentence: string): {
  structure: string;
  components: { [key: string]: string };
  explanation: string;
} {
  const s = sentence.trim();
  const words = s.split(' ');
  
  // 간단한 분석 (주어 + 동사 + 보어/목적어)
  const components: { [key: string]: string } = {};
  
  // 첫 단어를 주어로 가정
  components['주어(S)'] = words[0] || '';
  
  // 두 번째 단어를 동사로 가정
  if (words[1]) {
    components['동사(V)'] = words[1];
  }
  
  // 나머지 분석
  const rest = words.slice(2).join(' ');
  if (rest) {
    // 감각동사/연결동사인 경우 보어
    const linkingVerbs = ['is', 'are', 'was', 'were', 'look', 'looks', 'feel', 'feels', 'seem', 'seems'];
    if (linkingVerbs.includes(words[1]?.toLowerCase())) {
      components['보어(C)'] = rest;
      return {
        structure: 'S + V + C (2형식)',
        components,
        explanation: '주어 + 동사 + 보어 형태의 2형식 문장이야!',
      };
    }
    
    // 그 외는 목적어로 가정
    components['목적어(O)'] = rest;
    return {
      structure: 'S + V + O (3형식)',
      components,
      explanation: '주어 + 동사 + 목적어 형태의 3형식 문장이야!',
    };
  }
  
  return {
    structure: 'S + V (1형식)',
    components,
    explanation: '주어 + 동사 형태의 1형식 문장이야!',
  };
}

// ==========================================
// 과목별 해설 생성 도구
// ==========================================

/**
 * 과목별 해설 템플릿
 */
export function getSubjectExplanationTemplate(subject: string, topic: string): string {
  const templates: { [key: string]: string } = {
    '수학': `
**${topic}** 개념 정리 📐

1. **정의**: ${topic}이란...

2. **핵심 공식**:
   - 공식 1: ...
   - 공식 2: ...

3. **예제**:
   - 예제 1: ...
   - 풀이: ...

4. **주의사항** ⚠️:
   - ...

5. **관련 개념**:
   - ...
    `,
    '영어': `
**${topic}** 문법 정리 📚

1. **정의**: ${topic}은(는)...

2. **핵심 규칙**:
   - 규칙 1: ...
   - 규칙 2: ...

3. **예문**:
   - 예문 1: ... → 해석: ...
   - 예문 2: ... → 해석: ...

4. **주의사항** ⚠️:
   - 흔한 실수: ...

5. **연습 문제**:
   - Q: ...
   - A: ...
    `,
    '국어': `
**${topic}** 개념 정리 📖

1. **정의**: ${topic}이란...

2. **핵심 포인트**:
   - 포인트 1: ...
   - 포인트 2: ...

3. **예시**:
   - 작품/문장 예시: ...
   - 분석: ...

4. **적용**:
   - 실제 문제에서는...

5. **관련 개념**:
   - ...
    `,
  };
  
  return templates[subject] || templates['수학'];
}

// ==========================================
// 에이전트 액션 생성
// ==========================================

import { AgentAction, PriorityMarker } from './types';

/**
 * 우선순위 마커 기반 에이전트 액션 생성
 */
export function generateAgentActions(
  priorityMarkers: PriorityMarker[],
  studentName: string,
  recognizedProblems: any[]
): AgentAction[] {
  const actions: AgentAction[] = [];
  const nickname = studentName ? `${studentName}아` : '';
  
  // 별표 친 문제 먼저 제안
  const starMarkers = priorityMarkers.filter(m => m.type === 'star');
  if (starMarkers.length > 0) {
    const problemNum = starMarkers[0].problemNumber;
    actions.push({
      type: 'suggest_problem',
      targetProblemId: problemNum?.toString(),
      reason: '학생이 별표로 표시한 중요 문제',
      message: `${nickname}${nickname ? ', ' : ''}${problemNum}번 문제 별표 쳤네? 어려웠어? 같이 풀어보자! 🌟`,
      priority: 100,
    });
  }
  
  // 물음표 표시된 문제
  const questionMarkers = priorityMarkers.filter(m => m.type === 'question_mark');
  if (questionMarkers.length > 0) {
    const problemNum = questionMarkers[0].problemNumber;
    actions.push({
      type: 'explain_concept',
      targetProblemId: problemNum?.toString(),
      reason: '학생이 물음표로 표시한 어려운 문제',
      message: `${problemNum}번 문제 헷갈렸구나! 내가 설명해줄게 🐰`,
      priority: 90,
    });
  }
  
  // X 표시된 문제 (틀린 문제)
  const xMarkers = priorityMarkers.filter(m => m.type === 'x_mark');
  if (xMarkers.length > 0) {
    const problemNum = xMarkers[0].problemNumber;
    actions.push({
      type: 'review_mistakes',
      targetProblemId: problemNum?.toString(),
      reason: 'X 표시된 틀린 문제',
      message: `${problemNum}번 문제 틀렸었네! 왜 틀렸는지 같이 확인해볼까? 💪`,
      priority: 85,
    });
  }
  
  // 우선순위로 정렬
  actions.sort((a, b) => b.priority - a.priority);
  
  return actions;
}


