'use client';

import { useState, useRef } from 'react';
import styles from './ImageUploader.module.css';

interface ImageUploaderProps {
  studentId: string;
  assignmentId?: string;
  onUploadSuccess?: (imageUrl: string, fileId: string, imageUploadId?: string) => void;
  onAnalyzeSuccess?: (analysis: any, imageUrl?: string) => void;
  showAlerts?: boolean;
  onAnalyzeStateChange?: (analyzing: boolean) => void;
  onUploadStateChange?: (uploading: boolean) => void;
}

export default function ImageUploader({
  studentId,
  assignmentId,
  onUploadSuccess,
  onAnalyzeSuccess,
  showAlerts = true,
  onAnalyzeStateChange,
  onUploadStateChange,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 미리보기
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // 업로드
    setUploading(true);
    onUploadStateChange?.(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studentId', studentId);
      if (assignmentId) {
        formData.append('assignmentId', assignmentId);
      }

      const res = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '업로드 실패');
      }

      setUploadedImageId(data.fileId);
      const imageUploadId = data.imageUpload?._id || data.imageUploadId;
      onUploadSuccess?.(data.imageUrl, data.fileId, imageUploadId);

      // 자동 분석
      if (imageUploadId) {
        await analyzeImage(imageUploadId, data.imageUrl);
      } else {
        console.error('imageUploadId를 찾을 수 없습니다:', data);
        if (showAlerts) alert('이미지 업로드는 성공했지만 분석을 시작할 수 없어요. 다시 시도해주세요.');
      }
    } catch (error: any) {
      console.error('업로드 오류:', error);
      alert(error.message || '이미지 업로드에 실패했습니다.');
      setPreview(null);
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  };

  const analyzeImage = async (imageUploadId: string, imageUrl?: string) => {
    setAnalyzing(true);
    onAnalyzeStateChange?.(true);
    try {
      const res = await fetch('/api/images/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUploadId,
          studentId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '분석 실패');
      }

      onAnalyzeSuccess?.(data.analysis, imageUrl);
      if (showAlerts) alert('이미지 분석이 완료되었습니다!');
    } catch (error: any) {
      console.error('분석 오류:', error);
      if (showAlerts) alert(error.message || '이미지 분석에 실패했습니다.');
    } finally {
      setAnalyzing(false);
      onAnalyzeStateChange?.(false);
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.uploadArea}>
        {preview ? (
          <div className={styles.preview}>
            <img src={preview} alt="업로드된 이미지" className={styles.previewImage} />
            <button
              className={styles.removeBtn}
              onClick={() => {
                setPreview(null);
                setUploadedImageId(null);
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <p>교재나 문제를 사진으로 찍어주세요</p>
            <div className={styles.buttonGroup}>
              <button
                className={styles.uploadBtn}
                onClick={handleCameraClick}
                disabled={uploading}
              >
                📷 카메라
              </button>
              <button
                className={styles.uploadBtn}
                onClick={handleFileClick}
                disabled={uploading}
              >
                📁 갤러리
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {(uploading || analyzing) && (
        <div className={styles.status}>
          {uploading && <p>업로드 중...</p>}
          {analyzing && <p>이미지 분석 중...</p>}
        </div>
      )}
    </div>
  );
}
