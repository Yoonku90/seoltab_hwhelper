// ==========================================
// 🚨 Intervention System (개입 시스템)
// 예측 기반 선제적 개입
// ==========================================

import { predictPerformance, detectEarlyWeakness } from './predictor';
import { Collections } from '@/lib/db';

/**
 * 개입 액션 타입
 */
export type InterventionAction = 
  | 'suggest_review'       // 복습 제안
  | 'revisit_concept'      // 개념 재학습
  | 'recommend_break'      // 휴식 제안
  | 'adjust_difficulty'    // 난이도 조절
  | 'encourage';           // 격려

/**
 * 개입 타입
 */
export interface Intervention {
  studentId: string;
  action: InterventionAction;
  reason: string;
  priority: 'low' | 'medium' | 'high';
  message: string;
}

/**
 * 개입 필요 여부 확인 및 생성
 */
export async function checkAndGenerateIntervention(
  studentId: string,
  subject?: string
): Promise<Intervention | null> {
  try {
    // 약점 조기 감지
    const hasWeakness = await detectEarlyWeakness(studentId, subject || '');
    
    if (!hasWeakness) {
      return null;
    }
    
    // 성과 예측
    const prediction = await predictPerformance(studentId, subject);
    
    // 개입 액션 결정
    let action: InterventionAction = 'suggest_review';
    let reason = '약점 영역이 감지되었습니다.';
    let priority: 'low' | 'medium' | 'high' = 'medium';
    
    if (prediction.predictedScore < 50) {
      action = 'revisit_concept';
      reason = '기초 개념 이해가 부족합니다.';
      priority = 'high';
    } else if (prediction.predictedScore < 60) {
      action = 'suggest_review';
      reason = '복습이 필요합니다.';
      priority = 'medium';
    } else if (prediction.weakAreas.length >= 3) {
      action = 'recommend_break';
      reason = '많은 약점이 있어 집중 학습이 필요합니다.';
      priority = 'high';
    }
    
    // 메시지 생성
    const message = generateInterventionMessage(action, reason, prediction.weakAreas);
    
    return {
      studentId,
      action,
      reason,
      priority,
      message,
    };
  } catch (error) {
    console.error('[prediction/intervention] Error generating intervention:', error);
    return null;
  }
}

/**
 * 개입 메시지 생성
 */
function generateInterventionMessage(
  action: InterventionAction,
  reason: string,
  weakAreas: string[]
): string {
  const messages: Record<InterventionAction, string> = {
    suggest_review: `복습이 필요해요! ${weakAreas[0] || '약점 영역'}을 다시 확인해볼까요?`,
    revisit_concept: `기초 개념을 다시 배워볼까요? ${weakAreas[0] || '핵심 개념'}부터 차근차근!`,
    recommend_break: `많은 내용을 배웠네요! 잠시 쉬었다가 ${weakAreas[0] || '약점 영역'}에 집중해볼까요?`,
    adjust_difficulty: `난이도를 조절해서 학습해볼까요?`,
    encourage: `지금까지 잘하고 있어요! 계속 화이팅!`,
  };
  
  return messages[action] || messages.encourage;
}

