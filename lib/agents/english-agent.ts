// ==========================================
// 🔤 English Agent (영어 전용 에이전트)
// ==========================================

import { BaseAgent, Agent } from './base-agent';
import { Grade, Subject } from '@/lib/agent/fallback/default-rules';

/**
 * 영어 에이전트
 */
export class EnglishAgent extends BaseAgent implements Agent {
  constructor(studentId: string, grade: Grade, student: any = null) {
    super(studentId, grade, '영어', student);
  }
  
  async generateLearningPlan(): Promise<any> {
    return {
      subject: '영어',
      topics: ['동사', '감각동사', '수여동사'],
      difficulty: 3,
    };
  }
  
  async generateResponse(context: any): Promise<string> {
    return `Let's learn English! ${this.getStudentNickname()}!`;
  }
  
  async provideFeedback(answer: string, correctAnswer: string): Promise<string> {
    if (answer.toLowerCase() === correctAnswer.toLowerCase()) {
      return `Perfect! Well done, ${this.getStudentNickname()}!`;
    } else {
      return `Almost there! Try again, ${this.getStudentNickname()}!`;
    }
  }
}

