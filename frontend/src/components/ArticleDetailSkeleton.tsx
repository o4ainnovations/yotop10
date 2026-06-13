export function ArticleDetailSkeleton() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 py-20 sm:px-6 animate-pulse">
      {/* Cover image skeleton */}
      <div className="mb-10 h-64 sm:h-80 w-full rounded-xl bg-white/5" />

      {/* Title */}
      <div className="space-y-3 mb-8">
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="h-8 w-3/4 rounded bg-white/5" />
        <div className="h-8 w-1/2 rounded bg-white/5" />
      </div>

      {/* Author bar */}
      <div className="flex items-center gap-3 mb-10">
        <div className="h-10 w-10 rounded-full bg-white/5" />
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-white/5" />
          <div className="h-3 w-24 rounded bg-white/5" />
        </div>
      </div>

      {/* Body paragraphs */}
      <div className="space-y-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-full rounded bg-white/5" />
            <div className="h-4 w-full rounded bg-white/5" />
            <div className={`h-4 rounded bg-white/5 ${i % 3 === 0 ? 'w-4/5' : 'w-full'}`} />
          </div>
        ))}
      </div>
    </main>
  );
}
