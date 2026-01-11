// ==========================================
// 🔢 Math Agent (수학 전용 에이전트)
// ==========================================

import { BaseAgent, Agent } from './base-agent';
import { Grade, Subject } from '@/lib/agent/fallback/default-rules';

/**
 * 수학 에이전트
 */
export class MathAgent extends BaseAgent implements Agent {
  constructor(studentId: string, grade: Grade, student: any = null) {
    super(studentId, grade, '수학', student);
  }
  
  async generateLearningPlan(): Promise<any> {
    return {
      subject: '수학',
      topics: ['기초 연산', '방정식', '이차방정식'],
      difficulty: 3,
    };
  }
  
  async generateResponse(context: any): Promise<string> {
    return `수학 문제를 풀어볼까요? ${this.getStudentNickname()}!`;
  }
  
  async provideFeedback(answer: string, correctAnswer: string): Promise<string> {
    if (answer === correctAnswer) {
      return `정답이야! 잘했어, ${this.getStudentNickname()}!`;
    } else {
      return `아깝다! 조금만 더 생각해봐, ${this.getStudentNickname()}!`;
    }
  }
}

