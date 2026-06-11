export function SavedSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10 animate-pulse">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 h-7 w-24 rounded bg-white/5" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/5 p-5">
              <div className="h-32 w-full rounded-xl bg-white/5 mb-3" />
              <div className="h-5 w-3/4 rounded bg-white/5 mb-3" />
              <div className="flex items-center gap-3">
                <div className="h-3 w-20 rounded bg-white/5" />
                <div className="h-3 w-16 rounded bg-white/5" />
                <div className="h-3 w-12 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
