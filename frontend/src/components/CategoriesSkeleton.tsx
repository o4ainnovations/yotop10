export function CategoriesSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-3 py-6 sm:px-6 sm:py-10 animate-pulse">
      <div className="show-desktop mb-8 flex items-center gap-4">
        <div className="h-4 w-10 rounded bg-white/5" />
        <div className="h-4 w-20 rounded bg-white/5" />
      </div>
      <main className="mx-auto max-w-6xl">
        <div className="mb-6 h-7 w-32 rounded bg-white/5" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/5 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 rounded-full bg-white/5" />
                <div className="h-5 w-28 rounded bg-white/5" />
              </div>
              <div className="h-3 w-full rounded bg-white/5 mb-2" />
              <div className="h-3 w-3/4 rounded bg-white/5 mb-4" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
