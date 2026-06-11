export function NotificationsSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] max-w-[700px] mx-auto px-3 sm:px-5 py-5 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="h-5 w-5 rounded bg-white/5" />
        <div className="h-5 w-32 rounded bg-white/5" />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-white/5 border-l-4 border-l-transparent">
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 rounded bg-white/5 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 rounded bg-white/5" />
                <div className="h-3 w-1/2 rounded bg-white/5" />
                <div className="h-2 w-16 rounded bg-white/5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
