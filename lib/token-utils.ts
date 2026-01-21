/**
 * 🔐 학생 접근 토큰 유틸리티
 * 
 * studentId를 암호화된 토큰으로 변환하여 보안 강화
 */

import { createHash, randomBytes } from 'crypto';

// 비밀 키 (환경 변수로 관리 권장)
const SECRET_KEY = process.env.TOKEN_SECRET || 'seoltab_rangssam_secret_2024';

/**
 * studentId → 암호화 토큰 생성
 * 
 * 방식: studentId + 비밀키 + 타임스탬프를 해시
 */
export function generateAccessToken(studentId: string): string {
  const timestamp = Date.now().toString(36); // 36진수로 압축
  const payload = `${studentId}:${SECRET_KEY}:${timestamp}`;
  
  // SHA-256 해시 후 앞 12자리만 사용 (충분히 고유함)
  const hash = createHash('sha256').update(payload).digest('hex');
  const shortHash = hash.substring(0, 12);
  
  // Base64 URL-safe 형식으로 변환
  const token = Buffer.from(`${shortHash}:${timestamp}`).toString('base64url');
  
  return token;
}

/**
 * 간단한 랜덤 토큰 생성 (8자리)
 * DB에 저장하여 studentId와 매핑
 */
export function generateSimpleToken(): string {
  return randomBytes(6).toString('base64url').substring(0, 8);
}

/**
 * studentId를 짧은 해시로 변환 (고정값, DB 저장 불필요)
 * 단점: 동일 studentId는 항상 같은 토큰 생성
 */
export function studentIdToHash(studentId: string): string {
  const payload = `${studentId}:${SECRET_KEY}`;
  const hash = createHash('sha256').update(payload).digest('hex');
  return hash.substring(0, 10); // 10자리
}

/**
 * 해시 검증 (studentId가 해당 해시와 일치하는지)
 */
export function verifyHash(studentId: string, hash: string): boolean {
  const expectedHash = studentIdToHash(studentId);
  return expectedHash === hash;
}



