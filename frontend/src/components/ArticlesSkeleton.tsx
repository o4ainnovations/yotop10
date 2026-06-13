export function ArticlesSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-48 rounded bg-white/5 mb-8" />

      <div className="space-y-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4">
            {/* Cover image */}
            <div className="h-48 sm:h-56 w-full rounded-xl bg-white/5" />

            {/* Title */}
            <div className="space-y-2">
              <div className="h-6 w-3/4 rounded bg-white/5" />
              <div className="h-6 w-1/2 rounded bg-white/5" />
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-white/5" />
              <div className="h-4 w-full rounded bg-white/5" />
              <div className="h-4 w-2/3 rounded bg-white/5" />
            </div>

            {/* Meta */}
            <div className="flex items-center gap-4">
              <div className="h-3 w-24 rounded bg-white/5" />
              <div className="h-3 w-20 rounded bg-white/5" />
              <div className="h-3 w-16 rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
