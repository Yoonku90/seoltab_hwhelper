/**
 * 대한민국 시간(KST, UTC+9) 유틸리티
 * 모든 시간 처리는 대한민국 시간 기준으로 진행
 */

/**
 * UTC 시간을 대한민국 시간(KST)으로 변환
 * @param date UTC 시간 문자열 또는 Date 객체
 * @returns KST 기준 Date 객체
 */
export function toKST(date: string | Date): Date {
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  
  // UTC 시간을 KST로 변환 (UTC + 9시간)
  const kstTime = utcDate.getTime() + (9 * 60 * 60 * 1000);
  return new Date(kstTime);
}

/**
 * KST 기준으로 년도 추출
 * @param date UTC 시간 문자열 또는 Date 객체
 * @returns KST 기준 년도
 */
export function getKSTYear(date: string | Date): number {
  const kstDate = toKST(date);
  return kstDate.getFullYear();
}

/**
 * KST 기준으로 현재 년도 가져오기
 * @returns KST 기준 현재 년도
 */
export function getCurrentKSTYear(): number {
  const now = new Date();
  // UTC 시간을 기준으로 KST 계산 (UTC + 9시간)
  // getTime()은 UTC 기준 밀리초를 반환하므로, 여기에 9시간을 더하면 KST가 됨
  const kstTime = now.getTime() + (9 * 60 * 60 * 1000);
  return new Date(kstTime).getUTCFullYear();
}

/**
 * KST 기준으로 날짜 포맷팅
 * @param date UTC 시간 문자열 또는 Date 객체
 * @param options Intl.DateTimeFormatOptions
 * @returns KST 기준 포맷된 날짜 문자열
 */
export function formatKSTDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const kstDate = toKST(date);
  return kstDate.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    ...options,
  });
}

/**
 * KST 기준으로 날짜만 포맷팅 (시간 제외)
 * @param date UTC 시간 문자열 또는 Date 객체
 * @returns KST 기준 포맷된 날짜 문자열
 */
export function formatKSTDateOnly(date: string | Date): string {
  return formatKSTDate(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

