'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/home');
  }, [router]);

  return <div>리다이렉트 중...</div>;
}

