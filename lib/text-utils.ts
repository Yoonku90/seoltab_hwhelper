/**
 * LaTeX 명령어가 JSON escape되거나 손상된 경우를 복구하는 함수
 * 예: "rac" → "\frac", "sqrt" → "\sqrt"
 */
export function restoreLatexEscapes(text: string): string {
  if (!text) return text;

  let result = text;

  // JSON escape 복구: \\frac → \frac
  result = result.replace(/\\\\/g, '\\');

  // 흔한 LaTeX 명령어 복구
  // frac 관련
  result = result.replace(/\brac\b/g, '\\frac');
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{$1}{$2}');

  // sqrt 관련
  result = result.replace(/\bsqrt\b/g, '\\sqrt');
  result = result.replace(/\\sqrt\{([^}]+)\}/g, '\\sqrt{$1}');

  // 기타 흔한 명령어
  result = result.replace(/\bpi\b/g, '\\pi');
  result = result.replace(/\bsigma\b/g, '\\sigma');
  result = result.replace(/\btheta\b/g, '\\theta');
  result = result.replace(/\balpha\b/g, '\\alpha');
  result = result.replace(/\bbeta\b/g, '\\beta');
  result = result.replace(/\bgamma\b/g, '\\gamma');
  result = result.replace(/\bdelta\b/g, '\\delta');
  result = result.replace(/\bepsilon\b/g, '\\epsilon');
  result = result.replace(/\blambda\b/g, '\\lambda');
  result = result.replace(/\bmu\b/g, '\\mu');
  result = result.replace(/\bnu\b/g, '\\nu');
  result = result.replace(/\bomega\b/g, '\\omega');

  // 연산자
  result = result.replace(/\bcdot\b/g, '\\cdot');
  result = result.replace(/\btimes\b/g, '\\times');
  result = result.replace(/\bdiv\b/g, '\\div');
  result = result.replace(/\bpm\b/g, '\\pm');
  result = result.replace(/\bmp\b/g, '\\mp');

  // 관계 연산자
  result = result.replace(/\bleq\b/g, '\\leq');
  result = result.replace(/\bgeq\b/g, '\\geq');
  result = result.replace(/\bneq\b/g, '\\neq');
  result = result.replace(/\bapprox\b/g, '\\approx');
  result = result.replace(/\bequiv\b/g, '\\equiv');
  result = result.replace(/\bsim\b/g, '\\sim');

  // 화살표
  result = result.replace(/\brightarrow\b/g, '\\rightarrow');
  result = result.replace(/\bleftarrow\b/g, '\\leftarrow');
  result = result.replace(/\bRightarrow\b/g, '\\Rightarrow');
  result = result.replace(/\bLeftarrow\b/g, '\\Leftarrow');
  result = result.replace(/\bLeftrightarrow\b/g, '\\Leftrightarrow');

  // 집합
  result = result.replace(/\bin\b/g, '\\in');
  result = result.replace(/\bsubset\b/g, '\\subset');
  result = result.replace(/\bsupset\b/g, '\\supset');
  result = result.replace(/\bcap\b/g, '\\cap');
  result = result.replace(/\bcup\b/g, '\\cup');
  result = result.replace(/\bemptyset\b/g, '\\emptyset');

  // 기타
  result = result.replace(/\bint\b/g, '\\int');
  result = result.replace(/\bsum\b/g, '\\sum');
  result = result.replace(/\bprod\b/g, '\\prod');
  result = result.replace(/\blim\b/g, '\\lim');
  result = result.replace(/\binf\b/g, '\\infty');
  result = result.replace(/\bpartial\b/g, '\\partial');
  result = result.replace(/\bnabla\b/g, '\\nabla');

  // 행렬
  result = result.replace(/\bpmatrix\b/g, '\\pmatrix');
  result = result.replace(/\bbmatrix\b/g, '\\bmatrix');
  result = result.replace(/\bvmatrix\b/g, '\\vmatrix');
  result = result.replace(/\bmatrix\b/g, '\\matrix');

  // 텍스트
  result = result.replace(/\btext\b/g, '\\text');

  // 이미 백슬래시가 있는 경우 중복 제거
  result = result.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  return result;
}

