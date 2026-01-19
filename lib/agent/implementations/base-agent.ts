// ==========================================
// 🤖 Base Agent (기본 에이전트)
// 모든 에이전트의 기본 클래스
// ==========================================

import { Student } from '@/lib/types';
import { Grade, Subject } from '@/lib/agent/fallback/default-rules';

/**
 * 에이전트 인터페이스
 */
export interface Agent {
  studentId: string;
  grade: Grade;
  subject: Subject;
  
  // 학습 계획 생성
  generateLearningPlan(): Promise<any>;
  
  // 응답 생성
  generateResponse(context: any): Promise<string>;
  
  // 피드백 제공
  provideFeedback(answer: string, correctAnswer: string): Promise<string>;
}

/**
 * 기본 에이전트 클래스
 */
export abstract class BaseAgent implements Agent {
  studentId: string;
  grade: Grade;
  subject: Subject;
  student: Student | null;
  
  constructor(studentId: string, grade: Grade, subject: Subject, student: Student | null = null) {
    this.studentId = studentId;
    this.grade = grade;
    this.subject = subject;
    this.student = student;
  }
  
  abstract generateLearningPlan(): Promise<any>;
  abstract generateResponse(context: any): Promise<string>;
  abstract provideFeedback(answer: string, correctAnswer: string): Promise<string>;
  
  /**
   * 학생 이름 가져오기
   */
  protected getStudentName(): string {
    return this.student?.name || '학생';
  }
  
  /**
   * 학생 닉네임 가져오기
   */
  protected getStudentNickname(): string {
    return this.student?.nickname || this.getStudentName() + '아';
  }
}

