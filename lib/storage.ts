// 간단한 파일 기반 스토리지 (MongoDB 대체용)
// 개발/테스트용으로만 사용

import { promises as fs } from 'fs';
import { join } from 'path';
import {
  Assignment,
  Page,
  Problem,
  Attempt,
  HelpSession,
  TeacherDigest,
} from './types';

const DATA_DIR = join(process.cwd(), 'data');

// 데이터 디렉토리 초기화
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // 이미 존재하면 무시
  }
}

// 파일에서 데이터 읽기
async function readData<T>(filename: string): Promise<T[]> {
  await ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

// 파일에 데이터 쓰기
async function writeData<T>(filename: string, data: T[]): Promise<void> {
  await ensureDataDir();
  const filePath = join(DATA_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ID 생성
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 컬렉션별 파일명
const FILES = {
  assignments: 'assignments.json',
  pages: 'pages.json',
  problems: 'problems.json',
  attempts: 'attempts.json',
  help_sessions: 'help_sessions.json',
  teacher_digests: 'teacher_digests.json',
};

// 간단한 스토리지 인터페이스
export class SimpleStorage {
  // Assignments
  static async getAssignments(filter?: { studentId?: string; teacherId?: string }): Promise<Assignment[]> {
    const data = await readData<Assignment>(FILES.assignments);
    if (!filter) return data;
    return data.filter((item) => {
      if (filter.studentId && item.studentId !== filter.studentId) return false;
      if (filter.teacherId && item.teacherId !== filter.teacherId) return false;
      return true;
    });
  }

  static async getAssignment(id: string): Promise<Assignment | null> {
    const data = await readData<Assignment>(FILES.assignments);
    return data.find((item) => item._id === id) || null;
  }

  static async createAssignment(assignment: Omit<Assignment, '_id'>): Promise<Assignment> {
    const data = await readData<Assignment>(FILES.assignments);
    const newAssignment: Assignment = {
      ...assignment,
      _id: generateId(),
    };
    data.push(newAssignment);
    await writeData(FILES.assignments, data);
    return newAssignment;
  }

  static async updateAssignment(id: string, updates: Partial<Assignment>): Promise<void> {
    const data = await readData<Assignment>(FILES.assignments);
    const index = data.findIndex((item) => item._id === id);
    if (index >= 0) {
      data[index] = { ...data[index], ...updates, updatedAt: new Date() };
      await writeData(FILES.assignments, data);
    }
  }

  // Problems
  static async getProblems(assignmentId: string): Promise<Problem[]> {
    const data = await readData<Problem>(FILES.problems);
    return data.filter((item) => item.assignmentId === assignmentId);
  }

  static async getProblem(id: string): Promise<Problem | null> {
    const data = await readData<Problem>(FILES.problems);
    return data.find((item) => item._id === id) || null;
  }

  static async createProblem(problem: Omit<Problem, '_id'>): Promise<Problem> {
    const data = await readData<Problem>(FILES.problems);
    const newProblem: Problem = {
      ...problem,
      _id: generateId(),
    };
    data.push(newProblem);
    await writeData(FILES.problems, data);
    return newProblem;
  }

  static async updateProblem(id: string, updates: Partial<Problem>): Promise<void> {
    const data = await readData<Problem>(FILES.problems);
    const index = data.findIndex((item) => item._id === id);
    if (index >= 0) {
      data[index] = { ...data[index], ...updates, updatedAt: new Date() };
      await writeData(FILES.problems, data);
    }
  }

  // Attempts
  static async createAttempt(attempt: Omit<Attempt, '_id'>): Promise<Attempt> {
    const data = await readData<Attempt>(FILES.attempts);
    const newAttempt: Attempt = {
      ...attempt,
      _id: generateId(),
    };
    data.push(newAttempt);
    await writeData(FILES.attempts, data);
    return newAttempt;
  }

  // Help Sessions
  static async getHelpSessions(filter: { problemId?: string; studentId?: string; step?: number }): Promise<HelpSession[]> {
    const data = await readData<HelpSession>(FILES.help_sessions);
    return data.filter((item) => {
      if (filter.problemId && item.problemId !== filter.problemId) return false;
      if (filter.studentId && item.studentId !== filter.studentId) return false;
      if (filter.step !== undefined && item.step !== filter.step) return false;
      return true;
    });
  }

  static async createHelpSession(session: Omit<HelpSession, '_id'>): Promise<HelpSession> {
    const data = await readData<HelpSession>(FILES.help_sessions);
    const newSession: HelpSession = {
      ...session,
      _id: generateId(),
    };
    data.push(newSession);
    await writeData(FILES.help_sessions, data);
    return newSession;
  }

  // Teacher Digests
  static async getDigest(assignmentId: string): Promise<TeacherDigest | null> {
    const data = await readData<TeacherDigest>(FILES.teacher_digests);
    return data.find((item) => item.assignmentId === assignmentId) || null;
  }

  static async createOrUpdateDigest(digest: Omit<TeacherDigest, '_id'>): Promise<TeacherDigest> {
    const data = await readData<TeacherDigest>(FILES.teacher_digests);
    const index = data.findIndex((item) => item.assignmentId === digest.assignmentId);
    
    if (index >= 0) {
      data[index] = { ...data[index], ...digest };
      await writeData(FILES.teacher_digests, data);
      return data[index];
    } else {
      const newDigest: TeacherDigest = {
        ...digest,
        _id: generateId(),
      };
      data.push(newDigest);
      await writeData(FILES.teacher_digests, data);
      return newDigest;
    }
  }
}

