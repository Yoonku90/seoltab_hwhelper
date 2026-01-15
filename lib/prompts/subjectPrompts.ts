import { ENGLISH_SUBJECT_GUIDE } from '@/lib/prompts/subjects/english';
import { KOREAN_SUBJECT_GUIDE } from '@/lib/prompts/subjects/korean';
import { MATH_SUBJECT_GUIDE } from '@/lib/prompts/subjects/math';
import { SCIENCE_SUBJECT_GUIDE } from '@/lib/prompts/subjects/science';
import { SOCIAL_STUDIES_SUBJECT_GUIDE } from '@/lib/prompts/subjects/socialStudies';

export type SubjectGuideOptions = {
  subject?: string | null;
};

const DEFAULT_SUBJECT_GUIDE = [
  '**과목 공통 가이드:**',
  '- 핵심 개념 → 핵심 예시/문제 → 요약 흐름으로 정리',
].join('\n');

export function getSubjectGuide(subject?: string | null): string {
  const normalized = typeof subject === 'string' ? subject : '';

  if (normalized.includes('국어')) return KOREAN_SUBJECT_GUIDE;
  if (normalized.includes('영어')) return ENGLISH_SUBJECT_GUIDE;
  if (normalized.includes('수학')) return MATH_SUBJECT_GUIDE;
  if (normalized.includes('사회')) return SOCIAL_STUDIES_SUBJECT_GUIDE;
  if (normalized.includes('과학')) return SCIENCE_SUBJECT_GUIDE;

  return DEFAULT_SUBJECT_GUIDE;
}

