'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ImageUploader from '@/app/components/ImageUploader';
import styles from './page.module.css';

type Analysis = {
  extractedText?: string;
  subject?: string;
  pageNumber?: number | null;
  recognizedProblems?: Array<{
    number: number;
    text?: string;
    position?: { x: number; y: number; width: number; height: number };
  }>;
};

export default function NewSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [studentId, setStudentId] = useState('student1'); // 임시
  const [creating, setCreating] = useState(false);
  const [analysisState, setAnalysisState] = useState<Analysis | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  const analysisFromQuery = useMemo(() => {
    const raw = searchParams.get('imageAnalysis');
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw)) as Analysis;
    } catch {
      return null;
    }
  }, [searchParams]);

  const analysis = analysisState || analysisFromQuery;

  const createAssignmentAndGo = async () => {
    if (!analysis || !analysis.recognizedProblems?.length) {
      alert('인식된 문제가 없습니다. 다른 사진으로 다시 시도해보세요.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/sessions/from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          analysis,
          imageUrl: uploadedImageUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '세션 생성 실패');

      router.push(`/assignments/${data.assignmentId}`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || '세션 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/home')}>
          ← 홈
        </button>
        <div className={styles.headerText}>
          <h1>활동창</h1>
          <p>사진 업로드 → 문제 인식 → 과제로 생성 → 바로 진행</p>
        </div>
        <div className={styles.student}>
          <label>학생 ID</label>
          <input
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={styles.input}
          />
        </div>
      </header>

      <div className={styles.grid}>
        <section className={styles.left}>
          <h2 className={styles.sectionTitle}>1) 교재/문제 업로드</h2>
          <ImageUploader
            studentId={studentId}
            onUploadSuccess={(imageUrl, _fileId, _imageUploadId) => setUploadedImageUrl(imageUrl)}
            onAnalyzeSuccess={(payload: any) => {
              // 기존 구현은 analysis만 주지만, 확장 대비해 payload 형태도 허용
              const nextAnalysis = payload?.recognizedProblems ? payload : payload?.analysis;
              if (nextAnalysis) setAnalysisState(nextAnalysis);
            }}
          />
        </section>

        <section className={styles.right}>
          <h2 className={styles.sectionTitle}>2) 인식 결과</h2>

          {!analysis ? (
            <div className={styles.empty}>아직 분석 결과가 없어요. 사진을 올려주세요.</div>
          ) : (
            <>
              {uploadedImageUrl && (
                <div className={styles.imageWrap}>
                  <img className={styles.uploadedImage} src={uploadedImageUrl} alt="업로드한 원본 이미지" />
                </div>
              )}
              <div className={styles.meta}>
                <div>
                  <span className={styles.badge}>{analysis.subject || '미분류'}</span>
                  {analysis.pageNumber ? (
                    <span className={styles.badge}>p.{analysis.pageNumber}</span>
                  ) : null}
                </div>
                <button
                  className={styles.primaryBtn}
                  onClick={createAssignmentAndGo}
                  disabled={creating}
                >
                  {creating ? '생성 중…' : '이걸 과제로 만들고 시작하기'}
                </button>
              </div>

              <div className={styles.problemList}>
                {(analysis.recognizedProblems || []).length === 0 ? (
                  <div className={styles.empty}>
                    문제를 인식하지 못했어요. 더 선명하게 다시 찍어보세요.
                  </div>
                ) : (
                  (analysis.recognizedProblems || []).map((p, idx) => (
                    <div key={`${p.number}-${idx}`} className={styles.problemCard}>
                      <div className={styles.problemHeader}>
                        <strong>문제 {p.number}</strong>
                      </div>
                      <div className={styles.problemText}>{p.text || '(문제 텍스트 없음)'}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}


