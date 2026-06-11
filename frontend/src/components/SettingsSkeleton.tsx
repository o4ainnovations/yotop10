export function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 min-h-[calc(100vh-56px)] animate-pulse">
      <div className="mb-6 h-4 w-24 rounded bg-white/5" />
      <div className="mb-8 h-7 w-28 rounded bg-white/5" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-5 py-4">
            <div className="h-10 w-10 rounded-xl bg-white/5" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-white/5" />
              <div className="h-3 w-40 rounded bg-white/5" />
            </div>
            <div className="h-4 w-4 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
