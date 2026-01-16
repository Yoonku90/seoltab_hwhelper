'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ReviewProgramRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    router.replace(`/admin/lecture-summary?reviewProgramId=${id}`);
  }, [id, router]);

  return <div style={{ padding: 20 }}>요약본으로 이동 중...</div>;
}
 