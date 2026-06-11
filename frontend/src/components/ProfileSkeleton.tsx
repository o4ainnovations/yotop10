export function ProfileSkeleton() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[var(--color-bg)] px-4 py-8 sm:px-6 sm:py-12 animate-pulse">
      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="h-16 w-16 rounded-full bg-white/5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 rounded bg-white/5" />
            <div className="h-5 w-16 rounded-full bg-white/5" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/5" />
            <div className="h-3 w-14 rounded bg-white/5" />
            <div className="h-3 w-12 rounded bg-white/5" />
            <div className="h-3 w-24 rounded bg-white/5" />
          </div>
        </div>
      </div>

      {/* Trust gauge */}
      <div className="h-1.5 w-full rounded-full bg-white/5 mb-6" />

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <div className="h-8 w-20 rounded bg-white/5" />
        <div className="h-8 w-24 rounded bg-white/5" />
        <div className="h-8 w-16 rounded bg-white/5" />
      </div>

      {/* Post cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-14 rounded bg-white/5" />
              <div className="h-4 w-12 rounded bg-white/5" />
            </div>
            <div className="h-4 w-full rounded bg-white/5 mb-2" />
            <div className="h-4 w-3/4 rounded bg-white/5 mb-3" />
            <div className="flex gap-3">
              <div className="h-3 w-14 rounded bg-white/5" />
              <div className="h-3 w-12 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
