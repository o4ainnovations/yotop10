import { Suspense } from 'react';

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>Loading search...</div>}>
      {children}
    </Suspense>
  );
}
