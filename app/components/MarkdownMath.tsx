'use client'

import { useMemo } from 'react'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { restoreLatexEscapes } from '@/lib/text-utils'

/**
 * 마크다운, LaTeX, 옛한글을 모두 처리하는 통합 렌더러
 * 
 * 기능:
 * - 마크다운 문법 (표, 리스트, 강조 등)
 * - LaTeX 수식 렌더링
 * - 옛한글(아래아 ㆍ 포함) 합자 및 폰트 적용
 */
interface ContentRendererProps {
  content: string
  className?: string
}

// Legacy/비표준 LaTeX 표기 정규화 (표시용)
// - 일부 데이터에 "\d\not{3}" 같은 비표준 표기가 섞여 KaTeX에서 그대로 노출되는 문제를 방지
// - 저장값(DB)은 건드리지 않고 렌더링 직전에만 변환
function normalizeLatexForRender(latex: string): string {
  if (!latex) return latex

  let out = latex

  // \d\not{3} -> \dot{3}
  out = out.replace(/\\d\\not\s*\{\s*([^}]+?)\s*\}/g, (_m, inner) => `\\dot{${inner}}`)

  // (희귀) \d\not3 -> \dot{3}  (단일 토큰만 제한적으로 처리)
  out = out.replace(/\\d\\not\s*([0-9A-Za-z])/g, (_m, ch) => `\\dot{${ch}}`)

  return out
}

// 마크다운 표를 HTML로 변환
function convertMarkdownTable(text: string): string {
  // 전처리: 한 줄로 붙어있는 표를 줄바꿈으로 분리
  // 예: "| 수학 | 영어 ||---|---|---|| A | 90 |" → 각 행 분리
  let preprocessed = text
    // 구분선 패턴 앞뒤에 줄바꿈 추가: ||---|---|---| → \n|---|---|---|\n
    .replace(/\|(\|[-:]+)+\|/g, (match) => '\n' + match + '\n')
    // 데이터 행 분리: 끝 | 다음에 바로 시작 |가 오면 줄바꿈
    .replace(/\|\s*\|(?=[^-\n])/g, '|\n|')
  
  const lines = preprocessed.split('\n')
  const result: string[] = []
  let inTable = false
  let tableRows: string[][] = []
  let hasHeader = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    // 표 행 감지 (|로 시작하고 |로 끝나거나, |를 포함)
    if (line.startsWith('|') || (line.includes('|') && !line.startsWith('```'))) {
      if (!inTable) {
        inTable = true
        tableRows = []
        hasHeader = false
      }

      // 구분선 행 체크 (|---|---|)
      if (/^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-')) {
        hasHeader = tableRows.length > 0
        continue
      }

      // 셀 파싱 - 빈 셀도 유지
      // 마크다운 표 형식: | 셀1 | 셀2 | 셀3 |
      // split('|')하면: ['', ' 셀1 ', ' 셀2 ', ' 셀3 ', '']
      // 첫 번째와 마지막은 항상 빈 문자열이므로 제거
      const rawCells = line.split('|')
      const cells = rawCells
        .slice(1, -1)  // 첫 번째와 마지막 빈 문자열 제거
        .map(cell => cell.trim())  // 공백 제거

      tableRows.push(cells)
    } else {
      // 표 종료
      if (inTable && tableRows.length > 0) {
        result.push(buildTableHtml(tableRows, hasHeader))
        inTable = false
        tableRows = []
      }
      result.push(line)
    }
  }

  // 마지막 표 처리
  if (inTable && tableRows.length > 0) {
    result.push(buildTableHtml(tableRows, hasHeader))
  }

  return result.join('\n')
}

function buildTableHtml(rows: string[][], hasHeader: boolean): string {
  if (rows.length === 0) return ''

  // 모든 행의 열 개수를 헤더 행 기준으로 맞춤
  const headerColCount = rows.length > 0 ? rows[0].length : 0
  const normalizedRows = rows.map(row => {
    const normalized = [...row]
    // 부족한 열은 빈 문자열로 채움
    while (normalized.length < headerColCount) {
      normalized.push('')
    }
    // 초과하는 열은 제거
    return normalized.slice(0, headerColCount)
  })

  const tableStyle = 'border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;min-width:100%;background:#ffffff;'
  const thStyle = 'border:1px solid #e0e0e0;padding:10px 12px;background:#f0f0f0;font-weight:600;text-align:left;color:#333333;white-space:nowrap;'
  const tdStyle = 'border:1px solid #e0e0e0;padding:10px 12px;vertical-align:top;color:#333333;background:#ffffff;'
  const wrapperStyle = 'overflow-x:auto;overflow-y:visible;width:100%;max-width:100%;margin:12px 0;'

  let html = `<div style="${wrapperStyle}"><table style="${tableStyle}">`

  const startIdx = hasHeader ? 1 : 0

  if (hasHeader && normalizedRows.length > 0) {
    html += '<thead><tr>'
    normalizedRows[0].forEach(cell => {
      // 셀 내용에서 LaTeX 처리
      html += `<th style="${thStyle}">${processLatexInCell(cell)}</th>`
    })
    html += '</tr></thead>'
  }

  html += '<tbody>'
  for (let i = startIdx; i < normalizedRows.length; i++) {
    html += '<tr>'
    normalizedRows[i].forEach(cell => {
      // 셀 내용에서 LaTeX 처리
      html += `<td style="${tdStyle}">${processLatexInCell(cell)}</td>`
    })
    html += '</tr>'
  }
  html += '</tbody></table></div>'

  return html
}

// 셀 내용에서 LaTeX 처리
function processLatexInCell(text: string): string {
  // 빈 셀이면 &nbsp;로 공간 유지
  if (!text || text.trim() === '') {
    return '&nbsp;'
  }
  // 인라인 LaTeX 처리
  return text.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
    try {
      let restoredLatex = restoreLatexEscapes(latex)
      restoredLatex = normalizeLatexForRender(restoredLatex)
      return katex.renderToString(restoredLatex, { displayMode: false, throwOnError: false })
    } catch {
      return match
    }
  })
}

// LaTeX 명령어가 포함된 텍스트를 자동으로 $...$로 감싸기
function autoWrapLatex(text: string): string {
  // 이미 $...$로 감싸진 부분이 있으면 자동 감싸기 하지 않음
  if (/\$[^$]+\$/.test(text)) {
    return text
  }
  
  // 백슬래시로 시작하는 LaTeX 명령어 패턴 감지
  const latexCommandPattern = /\\[a-zA-Z]+(\{[^}]*\})*(\[[^\]]*\])*/

  if (!latexCommandPattern.test(text)) return text

  // 영어/국어 문장 전체를 수식으로 감싸면 오히려 깨짐.
  // "수학처럼 보이는 문자열"일 때만 auto-wrap.
  const hasStrongMathCue =
    /\\frac|\\sqrt|\\pi|\\int|\\sum|\\lim|\\sigma|\\theta|\\alpha|\\beta|\\gamma|\\cdot|\\times|\\leq|\\geq|\\neq|\\approx|\\Rightarrow|\\Leftrightarrow/.test(text) ||
    /[=^_]/.test(text) ||
    /\b[xyabmn]\b/.test(text) // y=ax+b 같은 패턴에서 최소 힌트

  if (!hasStrongMathCue) return text

  // LaTeX 명령어를 제외한 "일반 글자"가 너무 많으면(문장) 감싸지 않음
  const stripped = text.replace(latexCommandPattern, '')
  const plainLetters = (stripped.match(/[A-Za-z가-힣]/g) || []).length
  const hasSpaces = /\s/.test(stripped)
  if (plainLetters >= 12 && hasSpaces) return text

  return `$${text}$`
  
  return text
}

// 수학 표현식 패턴을 LaTeX로 변환 (예: "2x+3" → "$2x+3$")
function convertMathExpressions(text: string): string {
  if (!text) return text
  
  // 이미 $...$로 감싸진 부분은 건드리지 않음
  const parts: Array<{ text: string; isLatex: boolean }> = []
  let lastIndex = 0
  const latexMatches = Array.from(text.matchAll(/\$[^$]+\$/g))
  
  latexMatches.forEach((match) => {
    if (match.index !== undefined && match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isLatex: false })
    }
    parts.push({ text: match[0], isLatex: true })
    lastIndex = match.index! + match[0].length
  })
  
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isLatex: false })
  }
  
  if (parts.length === 0) {
    parts.push({ text, isLatex: false })
  }
  
  // 일반 텍스트 부분에서만 수학 표현식 변환
  return parts.map((part) => {
    if (part.isLatex) return part.text
    
    // 수학 표현식 패턴: 숫자 + 알파벳 변수(선택) + 연산자 + 숫자 + 알파벳 변수(선택)
    // 예: "2x+3", "x+1", "3x-2", "2x+3=x-1"
    // HTML 태그 내부는 제외
    return part.text.replace(/(?<!<[^>]*)(\d*[a-z]+\s*[+\-=<>≤≥≠±×÷]\s*\d*[a-z]*|\d+[a-z]+|[a-z]+\s*[+\-=<>≤≥≠±×÷]\s*\d+)/gi, (match) => {
      // 이미 LaTeX로 감싸져 있으면 스킵
      if (match.includes('$')) return match
      // HTML 태그 내부는 스킵
      if (match.includes('<') || match.includes('>')) return match
      // 너무 긴 문장은 스킵 (예: "방정식" 같은 한글 단어)
      if (match.length > 20) return match
      // 한글이 포함된 경우 스킵
      if (/[가-힣]/.test(match)) return match
      return `$${match.trim()}$`
    })
  }).join('')
}

// 옛한글 자모 감지 (초성/중성/종성 자모 포함)
function hasOldHangulJamo(text: string): boolean {
  // U+1100-11FF: Hangul Jamo (초성/중성/종성 자모)
  // U+A960-A97F: Hangul Jamo Extended-A
  // U+D7B0-D7FF: Hangul Jamo Extended-B
  // U+3130-318F: Hangul Compatibility Jamo (호환용 자모, ㆍ 포함)
  // 아래아: ㆍ (U+318D), ᆞ (U+119E)
  return /[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF\u3130-\u318F]/.test(text)
}

// 한글 자모를 합자된 음절 블록으로 변환
function combineHangulJamo(text: string): string {
  // 한글 자모 범위
  // 초성: U+1100-1112 (19개)
  // 중성: U+1161-1175 (21개)
  // 종성: U+11A8-11C2 (28개)
  
  let result = ''
  let i = 0
  
  while (i < text.length) {
    const char = text[i]
    const code = char.charCodeAt(0)
    
    // 초성 자모 범위 (U+1100-1112)
    if (code >= 0x1100 && code <= 0x1112) {
      const choseong = code - 0x1100 // 초성 인덱스 (0-18)
      
      // 다음 문자가 중성인지 확인
      if (i + 1 < text.length) {
        const nextChar = text[i + 1]
        const nextCode = nextChar.charCodeAt(0)
        
        // 중성 자모 범위 (U+1161-1175)
        if (nextCode >= 0x1161 && nextCode <= 0x1175) {
          const jungseong = nextCode - 0x1161 // 중성 인덱스 (0-20)
          
          // 종성이 있는지 확인
          if (i + 2 < text.length) {
            const nextNextChar = text[i + 2]
            const nextNextCode = nextNextChar.charCodeAt(0)
            
            // 종성 자모 범위 (U+11A8-11C2)
            if (nextNextCode >= 0x11A8 && nextNextCode <= 0x11C2) {
              const jongseong = nextNextCode - 0x11A8 // 종성 인덱스 (0-27)
              
              // 합자 공식: (초성 * 21 + 중성) * 28 + 종성 + 0xAC00
              const syllableCode = (choseong * 21 + jungseong) * 28 + jongseong + 0xAC00
              result += String.fromCharCode(syllableCode)
              i += 3
              continue
            }
          }
          
          // 종성 없이 초성+중성만 있는 경우
          const syllableCode = (choseong * 21 + jungseong) * 28 + 0xAC00
          result += String.fromCharCode(syllableCode)
          i += 2
          continue
        }
      }
    }
    
    // 합자할 수 없는 경우 원본 문자 그대로 추가
    result += char
    i++
  }
  
  return result
}

// 옛한글 부분을 span으로 감싸서 폰트 적용
function wrapOldHangul(text: string): string {
  // HTML 태그 내부의 텍스트도 처리해야 함 (예: <strong>고ḇ다</strong>)
  // 하지만 HTML 태그 자체는 건드리지 않음
  
  // 1단계: HTML 태그를 임시로 보호
  const htmlTags: string[] = []
  let protectedText = text.replace(/<[^>]+>/g, (match) => {
    htmlTags.push(match)
    return `__HTML_TAG_${htmlTags.length - 1}__`
  })
  
  // 2단계: 옛한글 자모가 포함된 부분 찾기
  // 일반 한글 + 옛한글 자모 조합도 포함 (예: '소ᄂᆞᆯ', '므를')
  // 옛한글 자모가 포함된 연속된 문자 그룹을 찾아서 전체를 감싸기
  // 패턴: 일반 한글이 0개 이상 + 옛한글 자모 1개 이상 + (일반 한글 또는 옛한글 자모) 0개 이상
  // 단어 경계를 고려하여 더 정확하게 매칭
  // 옛한글 자모 범위: U+1100-11FF (Hangul Jamo), U+A960-A97F (Extended-A), U+D7B0-D7FF (Extended-B), U+3130-318F (Compatibility)
  const oldHangulPattern = /([가-힣ㄱ-ㅎㅏ-ㅣ]*[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF\u3130-\u318F]+[가-힣ㄱ-ㅎㅏ-ㅣ\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF\u3130-\u318F]*)/g
  
  let result = protectedText
  let lastIndex = 0
  const matches: Array<{ start: number; end: number; text: string }> = []
  
  // 모든 매칭 위치 찾기
  let match
  while ((match = oldHangulPattern.exec(protectedText)) !== null) {
    if (hasOldHangulJamo(match[0]) && !match[0].includes('<span')) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      })
    }
  }
  
  // 뒤에서부터 처리하여 인덱스가 꼬이지 않도록
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i]
    // 옛한글 자모를 합자된 형태로 변환
    const combined = combineHangulJamo(m.text)
    const before = result.substring(0, m.start)
    const after = result.substring(m.end)
    result = before + `<span class="old-hangul">${combined}</span>` + after
  }
  
  // 3단계: HTML 태그 복원
  htmlTags.forEach((tag, idx) => {
    result = result.replace(`__HTML_TAG_${idx}__`, tag)
  })
  
  return result
}

// 마크다운 + HTML을 처리하고 LaTeX를 렌더링
function renderContent(text: string): string {
  if (!text) return ''

  // 0. 옛한글 폰트 적용 (가장 먼저 처리, HTML 변환 전)
  text = wrapOldHangul(text)

  // 0. LaTeX 수식 내부의 잘못된 줄바꿈 먼저 제거 (가장 먼저 처리)
  // $...$ 내부의 줄바꿈을 제거 (예: t\nh\ne → the)
  let processedText = text.replace(/\$([^$]+?)\$/g, (match, latex) => {
    // LaTeX 내부의 실제 줄바꿈과 캐리지 리턴을 모두 제거
    const cleaned = latex.replace(/[\r\n]+/g, '').trim()
    return `$${cleaned}$`
  })
  
  // 0-1. LaTeX 블록 ($$...$$) 내부의 줄바꿈도 제거
  processedText = processedText.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    const cleaned = latex.replace(/[\r\n]+/g, ' ').trim() // 줄바꿈을 공백으로 변환
    return `$$${cleaned}$$`
  })
  
  // 수학 표현식 자동 변환 (먼저 처리)
  processedText = convertMathExpressions(processedText)
  
  // LaTeX 명령어 자동 감싸기
  processedText = autoWrapLatex(processedText)
  // 탭 문자는 거의 항상 JSON escape/파손의 부산물이라 제거 (times -> t\times 등)
  processedText = processedText.replace(/\u0009/g, '')

  // LaTeX escape 복구 (rac → \frac 등)
  let result = restoreLatexEscapes(processedText)

  // (주의) 개발 중 디버그 로그는 렌더링 노이즈가 커서 비활성화

  // 0. 코드 블록 보호 (먼저 처리)
  const codeBlocks: string[] = []
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match)
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`
  })

  // 0-1. LaTeX 블록 보호 ($$...$$ 먼저)
  const latexBlocks: string[] = []
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    latexBlocks.push(match)
    return `<<<LATEX_BLOCK_${latexBlocks.length - 1}>>>`
  })

  // 0-2. LaTeX 인라인 보호 ($...$)
  // 더 robust한 정규식: $ 다음에 공백이 아닌 문자로 시작, $ 전에 공백이 아닌 문자로 끝남
  const latexInlines: string[] = []
  result = result.replace(/\$([^\$]+?)\$/g, (match) => {
    latexInlines.push(match)
    return `<<<LATEX_INLINE_${latexInlines.length - 1}>>>`
  })

  // LaTeX 밖(일반 텍스트)에서 새어나온 LaTeX 토큰은 영문 텍스트로 복구
  // 예: many \times -> many times (영어 과목에서 특히 중요)
  result = result.replace(/\\times\b/g, 'times')

  // 1. 마크다운 표 변환 (LaTeX 보호 후 처리)
  // 주의: 표는 visualAids 섹션에만 표시되므로 detailedContent에서는 제거
  // 표를 제거하려면 아래 주석을 해제하세요
  // result = result.replace(/^\|.*\|$/gm, '') // 표 행 제거
  result = convertMarkdownTable(result)

  // 2. 빈칸(____) 처리: 언더스코어 4개 이상 연속은 빈칸으로 변환
  // LaTeX 밖에서만 변환됨 (LaTeX는 이미 플레이스홀더로 보호됨)
  result = result.replace(/_{4,}/g, (m) => {
    const width = Math.max(4, m.length * 0.6)
    return `<span style="display:inline-block;min-width:${width}em;border-bottom:2px solid #333;margin:0 0.2em;vertical-align:middle;position:relative;top:-0.5em;">&nbsp;</span>`
  })

  // 3. 마크다운 제목 변환 (### → strong with 20px, 먼저 처리)
  result = result
    .replace(/^###\s+(.+)$/gm, '<strong style="font-size:20px;display:block;margin:16px 0 8px 0;">$1</strong>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // 3-0. 구분선 처리 (---, ***, ___) - 시각적으로 명확한 구분선
  result = result
    .replace(/^[-*_]{3,}$/gm, '<hr style="border:none;border-top:2px solid rgba(0,0,0,0.1);margin:24px 0;width:100%;" />')

  // 3-1. 마크다운 변환 (형광펜 먼저 처리)
  result = result
    .replace(/==([\s\S]+?)==/g, '<mark style="background:linear-gradient(transparent 45%, #fff59d 45%);color:#111;padding:0 3px;border-radius:2px;">$1</mark>')
    .replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/~~([\s\S]+?)~~/g, '<del>$1</del>')
    .replace(/__([\s\S]+?)__/g, '<u>$1</u>')

  // 남아있는 ** 같은 잔여 마크다운 토큰 제거
  result = result.replace(/\*\*/g, '')

  // 4. 번호 리스트 처리 (1. 2. 3. 형식)
  result = result.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="margin-left:1em;margin-bottom:0.5em;"><strong>$1.</strong> $2</div>')

  // 4-1. 중점 리스트 처리 (- 형식 → • 중점으로 변환)
  result = result.replace(/^-\s+(.+)$/gm, '<div style="margin-left:1em;margin-bottom:0.3em;">• $1</div>')

  // 4-2. 체크마크 리스트가 한 줄에 붙는 경우 줄바꿈 강제
  // 예: "✓ A ✓ B" -> "✓ A\n✓ B"
  result = result.replace(/([^\n])\s*([✓✔️✔✅])\s+/g, '$1\n$2 ')

  // 5. 줄바꿈 처리 (단, HTML 태그 내부는 제외)
  // <br> 태그 또는 \n을 실제 줄바꿈으로
  result = result.replace(/\\n/g, '\n')
  result = result.replace(/(?<![>])\n(?![<])/g, '<br>')

  // 6. LaTeX 블록 복원 및 렌더링
  latexBlocks.forEach((block, idx) => {
    let latex = block.replace(/^\$\$/, '').replace(/\$\$$/, '')
    // LaTeX escape 복구 (rac → \frac 등) - 복원 시점에 다시 확인
    latex = restoreLatexEscapes(latex)
    latex = normalizeLatexForRender(latex)
    // 렌더링 직전 최종 방어: \t\text / <TAB>ext{ / \t{...} 등
    latex = latex
      // 실제 탭 문자로 인해 \text가 깨진 케이스: "<TAB>ext{"
      .replace(/\u0009ext\{/g, '\\text{')
      .replace(/\text\{/g, '\\text{')
      // 잘못된 "\t\text" 토큰 제거
      .replace(/\\t\s*(?=\\text)/g, '')
      .replace(/\\t\\text\{/g, '\\text{')
      .replace(/\\t\\text/g, '\\text')
      // "\t{...}" 를 "\text{...}" 로 복구 (일부 케이스)
      .replace(/\\t\{/g, '\\text{')
      // 실제 탭 문자 + "ext{" 조합
      .replace(/\text\{/g, '\\text{')
    // LaTeX 내부 빈칸(____) → \underline{\hspace{3em}} 로 변환
    latex = latex.replace(/_{4,}/g, '\\underline{\\hspace{3em}}')
    // 행렬 행 구분자 복구: "\ " (백슬래시+공백) → "\\" (이중 백슬래시)
    if (latex.includes('matrix')) {
      latex = latex.replace(/\\\s+(?=[a-zA-Z0-9\-])/g, '\\\\ ')
    }
    try {
      const rendered = `<div style="margin:12px 0;text-align:center;">${katex.renderToString(latex, { displayMode: true, throwOnError: false })}</div>`
      result = result.replace(`<<<LATEX_BLOCK_${idx}>>>`, rendered)
    } catch {
      result = result.replace(`<<<LATEX_BLOCK_${idx}>>>`, `<span style="color:#cc0000">${block}</span>`)
    }
  })

  // 7. LaTeX 인라인 복원 및 렌더링
  latexInlines.forEach((inline, idx) => {
    let latex = inline.replace(/^\$/, '').replace(/\$$/, '')
    // LaTeX escape 복구 (rac → \frac 등) - 복원 시점에 다시 확인
    latex = restoreLatexEscapes(latex)
    latex = normalizeLatexForRender(latex)
    // 렌더링 직전 최종 방어: \t\text / <TAB>ext{ / \t{...} 등
    latex = latex
      .replace(/\u0009ext\{/g, '\\text{')
      .replace(/\text\{/g, '\\text{')
      .replace(/\\t\s*(?=\\text)/g, '')
      .replace(/\\t\\text\{/g, '\\text{')
      .replace(/\\t\\text/g, '\\text')
      .replace(/\\t\{/g, '\\text{')
      .replace(/\text\{/g, '\\text{')
    // LaTeX 내부 빈칸(____) → \underline{\hspace{3em}} 로 변환
    latex = latex.replace(/_{4,}/g, '\\underline{\\hspace{3em}}')
    // 행렬 행 구분자 복구: "\ " (백슬래시+공백) → "\\" (이중 백슬래시)
    // pmatrix, bmatrix, matrix 안에서 \ 다음에 공백이 오면 \\로 변환
    if (latex.includes('matrix')) {
      latex = latex.replace(/\\\s+(?=[a-zA-Z0-9\-])/g, '\\\\ ')
    }
    try {
      const rendered = katex.renderToString(latex, { displayMode: false, throwOnError: false })
      result = result.replace(`<<<LATEX_INLINE_${idx}>>>`, rendered)
    } catch (error) {
      console.error(`[LatexRenderer] LaTeX 렌더링 실패 (인라인 ${idx}):`, latex, error)
      result = result.replace(`<<<LATEX_INLINE_${idx}>>>`, `<span style="color:#cc0000">${inline}</span>`)
    }
  })

  // 7-1. \[...\] 및 \(...\) 형식도 처리 (보호되지 않은 것들)
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
    try {
      let restoredLatex = restoreLatexEscapes(latex)
      restoredLatex = normalizeLatexForRender(restoredLatex)
      return `<div style="margin:12px 0;text-align:center;">${katex.renderToString(restoredLatex, { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `<span style="color:#cc0000">${match}</span>`
    }
  })
  result = result.replace(/\\\(([^)]+?)\\\)/g, (match, latex) => {
    try {
      let restoredLatex = restoreLatexEscapes(latex)
      restoredLatex = normalizeLatexForRender(restoredLatex)
      return katex.renderToString(restoredLatex, { displayMode: false, throwOnError: false })
    } catch {
      return `<span style="color:#cc0000">${match}</span>`
    }
  })

  // 8. 코드 블록 복원 (마지막에 처리)
  codeBlocks.forEach((block, idx) => {
    // 코드 블록 구분자 제거하고 내용만 표시
    const content = block.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '').trim()
    result = result.replace(`__CODE_BLOCK_${idx}__`, `<pre style="background:#f5f5f5;padding:1em;border-radius:4px;overflow-x:auto;font-family:monospace;font-size:0.9em;">${content}</pre>`)
  })

  return result
}

/**
 * 마크다운, LaTeX, 옛한글을 모두 처리하는 통합 렌더러 컴포넌트
 * 
 * @deprecated 컴포넌트 이름은 MarkdownMath이지만, 실제로는 마크다운/LaTeX/옛한글을 모두 처리합니다.
 * 향후 MarkdownRenderer로 이름 변경 예정.
 */
export default function MarkdownMath({ content, className = '' }: ContentRendererProps) {
  const html = useMemo(() => {
    const rendered = renderContent(content || '')
    
    // 옛한글 폰트 로딩 확인 (개발 환경)
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      const hasOldHangul = hasOldHangulJamo(rendered)
      
      if (hasOldHangul) {
        const detectedJamo = rendered.match(/[\u1100-\u11FF\uA960-\uA97F\uD7B0-\uD7FF\u3130-\u318F]+/g)
        console.log('[MarkdownMath] 옛한글 자모 감지됨:', detectedJamo)
        
        // 폰트 로딩 확인
        document.fonts.ready.then(() => {
          setTimeout(() => {
            const oldHangulElements = document.querySelectorAll('.old-hangul')
            if (oldHangulElements.length > 0) {
              const firstElement = oldHangulElements[0] as HTMLElement
              const computedStyle = window.getComputedStyle(firstElement)
              const actualFont = computedStyle.fontFamily
              console.log('[MarkdownMath] 실제 적용된 폰트:', actualFont)
            }
          }, 100)
        })
      }
    }
    
    return rendered
  }, [content])

  return (
    <span
      className={`whitespace-pre-wrap ${className}`}
      style={{ display: 'block', lineHeight: '1.8' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// 문제 렌더링용 (빈칸 문제 처리 포함)
export function ProblemRenderer({ content, className = '' }: ContentRendererProps) {
  const html = useMemo(() => {
    let result = content || ''
    
    // [[정답]] 형식의 빈칸을 빈칸으로 변환
    result = result.replace(/\[\[([^\]]+)\]\]/g, () => {
      return `<span style="display:inline-block;min-width:4em;border-bottom:2px solid #333;margin:0 2px;">&nbsp;</span>`
    })
    
    return renderContent(result)
  }, [content])

  return (
    <span
      className={`whitespace-pre-wrap ${className}`}
      style={{ display: 'block', lineHeight: '1.8' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
