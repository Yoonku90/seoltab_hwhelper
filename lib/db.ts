import { MongoClient, Db, Collection, Document } from 'mongodb';
import {
  Assignment,
  Page,
  Problem,
  Attempt,
  HelpSession,
  TeacherDigest,
  ImageUpload,
  AITutorSession,
  LearningEvent,
  LearningConsultation,
  PerformanceTask,
  ReviewProgram,
  Student,
} from './types';

if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // 개발 환경에서는 전역 변수에 저장하여 재사용
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // 프로덕션 환경
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

// 컬렉션 가져오기 헬퍼
export async function getCollection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

// 인덱스 생성
export async function createIndexes() {
  const db = await getDb();

  // problems 인덱스
  await db.collection('problems').createIndex({ assignmentId: 1 });
  await db.collection('problems').createIndex({ assignmentId: 1, 'latestAttempt.status': 1 });

  // attempts 인덱스
  await db.collection('attempts').createIndex({ problemId: 1, studentId: 1, createdAt: -1 });
  await db.collection('attempts').createIndex({ assignmentId: 1, studentId: 1 });

  // assignments 인덱스
  await db.collection('assignments').createIndex({ studentId: 1, dueAt: 1 });
  await db.collection('assignments').createIndex({ teacherId: 1 });

  // teacher_digests 인덱스
  await db.collection('teacher_digests').createIndex({ assignmentId: 1 });
  await db.collection('teacher_digests').createIndex({ studentId: 1 });

  // help_sessions 인덱스
  await db.collection('help_sessions').createIndex({ problemId: 1, studentId: 1 });
  await db.collection('help_sessions').createIndex({ assignmentId: 1 });

  // image_uploads 인덱스
  await db.collection('image_uploads').createIndex({ studentId: 1, uploadedAt: -1 });
  await db.collection('image_uploads').createIndex({ assignmentId: 1 });

  // ai_tutor_sessions 인덱스
  await db.collection('ai_tutor_sessions').createIndex({ problemId: 1, studentId: 1 });
  await db.collection('ai_tutor_sessions').createIndex({ assignmentId: 1, studentId: 1 });

  // learning_events 인덱스 (멈춤 감지용)
  await db.collection('learning_events').createIndex({ studentId: 1, timestamp: -1 });
  await db.collection('learning_events').createIndex({ problemId: 1, eventType: 1 });
  await db.collection('learning_events').createIndex({ assignmentId: 1, eventType: 1 });

  // learning_consultations 인덱스
  await db.collection('learning_consultations').createIndex({ studentId: 1, createdAt: -1 });

  // performance_tasks 인덱스
  await db.collection('performance_tasks').createIndex({ studentId: 1, dueAt: 1 });
  await db.collection('performance_tasks').createIndex({ teacherId: 1 });

  // review_programs 인덱스
  await db.collection('review_programs').createIndex({ studentId: 1, startAt: 1 });
  await db.collection('review_programs').createIndex({ originalSessionId: 1 });

  console.log('MongoDB 인덱스 생성 완료');
}

// 컬렉션 타입 정의
export const Collections = {
  assignments: () => getCollection<Assignment>('assignments'),
  pages: () => getCollection<Page>('pages'),
  problems: () => getCollection<Problem>('problems'),
  attempts: () => getCollection<Attempt>('attempts'),
  help_sessions: () => getCollection<HelpSession>('help_sessions'),
  teacher_digests: () => getCollection<TeacherDigest>('teacher_digests'),
  imageUploads: () => getCollection<ImageUpload>('image_uploads'),
  aiTutorSessions: () => getCollection<AITutorSession>('ai_tutor_sessions'),
  learningEvents: () => getCollection<LearningEvent>('learning_events'),
  learningConsultations: () => getCollection<LearningConsultation>('learning_consultations'),
  performanceTasks: () => getCollection<PerformanceTask>('performance_tasks'),
  reviewPrograms: () => getCollection<ReviewProgram>('review_programs'),
  students: () => getCollection<Student>('students'), // AI 에이전트: 학생 프로필
  learningSessions: () => getCollection<any>('learning_sessions'), // 학습 세션 (간격 반복용)
};

