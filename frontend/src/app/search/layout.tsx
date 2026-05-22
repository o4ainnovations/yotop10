import { Suspense } from 'react';

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-10 text-center text-zinc-500">Loading search...</div>}>
      {children}
    </Suspense>
  );
}
