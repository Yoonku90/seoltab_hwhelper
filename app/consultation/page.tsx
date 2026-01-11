'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function ConsultationPage() {
  const [message, setMessage] = useState('');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>학습 고민 상담</h1>
        <p>현재는 UI만 준비되어 있어요. 다음 단계에서 AI 상담 API를 연결합니다.</p>
      </header>

      <div className={styles.card}>
        <textarea
          className={styles.textarea}
          placeholder="예: 숙제를 시작하려고 하면 너무 하기 싫어요. 어떻게 해야 할까요?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className={styles.primaryBtn}
          onClick={() => alert('다음 단계에서 AI 상담 기능을 연결할게요!')}
          disabled={!message.trim()}
        >
          상담 시작(준비중)
        </button>
      </div>
    </div>
  );
}


