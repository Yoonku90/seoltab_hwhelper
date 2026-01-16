import { H1_RAG_CURRICULUM_2022 } from '@/lib/curriculum/h1';
import { H2H3_GENERAL_ELECTIVES_2022 } from '@/lib/curriculum/h23';
import { M1_RAG_CURRICULUM_2022 } from '@/lib/curriculum/m1';
import { M2_RAG_CURRICULUM_2022 } from '@/lib/curriculum/m2';
import { M3_RAG_CURRICULUM_2022 } from '@/lib/curriculum/m3';

type BaseSubunit = {
  title: string;
  concepts: string[];
  keywords: string[];
  sttTriggers: string[];
};

type BaseUnit = {
  subjectCode: string;
  subjectKr: string;
  unit?: string;
  course?: string;
  courseKr?: string;
  subunits?: BaseSubunit[];
  units?: BaseSubunit[];
};

type CurriculumMatch = {
  score: number;
  subjectKr: string;
  course: string;
  unitTitle: string;
  subunitTitle: string;
  concepts: string[];
  matchedKeywords: string[];
};

type BuildCurriculumHintParams = {
  sttText?: string | null;
  subject?: string | null;
  gradeLabel?: string | null;
};

function normalizeText(input: string): string {
  return input.toLowerCase();
}

function resolveSubjectCode(subject?: string | null): string | null {
  const normalized = typeof subject === 'string' ? subject : '';
  if (normalized.includes('국어')) return 'KOR';
  if (normalized.includes('영어')) return 'ENG';
  if (normalized.includes('수학')) return 'MAT';
  if (normalized.includes('사회')) return 'SOC';
  if (normalized.includes('과학')) return 'SCI';
  if (normalized.includes('정보')) return 'INF';
  return null;
}

function resolveCurriculumByGrade(gradeLabel?: string | null): BaseUnit[] | null {
  const label = typeof gradeLabel === 'string' ? gradeLabel : '';
  if (label.includes('중1')) return M1_RAG_CURRICULUM_2022 as unknown as BaseUnit[];
  if (label.includes('중2')) return M2_RAG_CURRICULUM_2022 as unknown as BaseUnit[];
  if (label.includes('중3')) return M3_RAG_CURRICULUM_2022 as unknown as BaseUnit[];
  if (label.includes('고1')) return H1_RAG_CURRICULUM_2022 as unknown as BaseUnit[];
  if (label.includes('고2') || label.includes('고3')) {
    return H2H3_GENERAL_ELECTIVES_2022 as unknown as BaseUnit[];
  }
  return null;
}

function collectMatchesForUnit(unit: BaseUnit, textLower: string): CurriculumMatch[] {
  const subunits = unit.subunits ?? unit.units ?? [];
  const course = unit.courseKr || unit.course || unit.unit || unit.subjectKr;
  const unitTitle = unit.unit || unit.course || unit.courseKr || unit.subjectKr;

  return subunits
    .map((subunit) => {
      const candidates = [...subunit.keywords, ...subunit.sttTriggers, ...subunit.concepts]
        .map((term) => term.trim())
        .filter(Boolean);

      const matched = new Set<string>();
      for (const term of candidates) {
        const termLower = normalizeText(term);
        if (termLower && textLower.includes(termLower)) {
          matched.add(term);
        }
      }

      const score = matched.size;
      return {
        score,
        subjectKr: unit.subjectKr,
        course,
        unitTitle,
        subunitTitle: subunit.title,
        concepts: subunit.concepts,
        matchedKeywords: Array.from(matched),
      };
    })
    .filter((match) => match.score > 0);
}

export function buildCurriculumHint(params: BuildCurriculumHintParams): string | null {
  const { sttText, subject, gradeLabel } = params;
  if (!sttText || sttText.trim().length === 0) return null;

  const subjectCode = resolveSubjectCode(subject);
  const curriculum = resolveCurriculumByGrade(gradeLabel);
  if (!subjectCode || !curriculum) return null;

  const textLower = normalizeText(sttText);
  const matches: CurriculumMatch[] = [];

  for (const unit of curriculum) {
    if (unit.subjectCode !== subjectCode) continue;
    matches.push(...collectMatchesForUnit(unit, textLower));
  }

  if (matches.length === 0) {
    return '**커리큘럼 힌트 (RAG 매칭 결과):**\n- 해당 학년/과목에서 일치하는 키워드가 없습니다.';
  }

  const topMatches = matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((match, index) => {
      const matchedText = match.matchedKeywords.slice(0, 6).join(', ');
      const conceptText = match.concepts.slice(0, 6).join(', ');
      return `${index + 1}) ${match.course} > ${match.subunitTitle}\n   - 핵심 개념: ${conceptText}\n   - 매칭 키워드: ${matchedText}`;
    })
    .join('\n');

  return `**커리큘럼 힌트 (RAG 매칭 결과):**\n${topMatches}`;
}

