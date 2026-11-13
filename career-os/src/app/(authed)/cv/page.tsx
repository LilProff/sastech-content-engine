import { Suspense } from 'react';
import { CvManager } from '@/components/cv/CvManager';

export default function CvPage() {
  return (
    <Suspense fallback={null}>
      <CvManager />
    </Suspense>
  );
}
