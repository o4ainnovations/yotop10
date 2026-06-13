export function HomeSkeleton() {
  return (
    <>
      {/* ── Mobile skeleton (unchanged) ── */}
      <div className="block md:hidden px-3 pt-6 space-y-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="flex gap-3 overflow-hidden">
            <div className="h-44 w-[76vw] shrink-0 rounded-2xl bg-white/5" />
            <div className="h-44 w-[76vw] shrink-0 rounded-2xl bg-white/5" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-white/5" />
          <div className="h-28 rounded-xl bg-white/5" />
          <div className="h-28 rounded-xl bg-white/5" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-white/5" />
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-full bg-white/5" />
            <div className="h-7 w-20 rounded-full bg-white/5" />
            <div className="h-7 w-14 rounded-full bg-white/5" />
            <div className="h-7 w-24 rounded-full bg-white/5" />
          </div>
          <div className="h-36 rounded-xl bg-white/5" />
        </div>
        <div className="space-y-2">
          <div className="h-20 rounded-xl bg-white/5" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="h-24 rounded-xl bg-white/5" />
          <div className="h-24 rounded-xl bg-white/5" />
        </div>
      </div>

      {/* ── Desktop skeleton (matches current 3-col grid homepage) ── */}
      <div className="block max-md:hidden px-4 lg:px-6 pt-6 pb-12 animate-pulse">
        {/* Carousel skeleton */}
        <div className="space-y-3 mb-10">
          <div className="h-4 w-24 rounded bg-white/5" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 flex-1 rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {/* Row 1: Debates (2/3) + Articles (1/3) */}
          <div className="col-span-2 lg:col-span-2 space-y-4">
            <div className="h-4 w-28 rounded bg-white/5" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-72 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="grid-cols-2 lg:grid-cols-1 gap-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>

          {/* Row 2: Categories + Facts */}
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-28 rounded bg-white/5" />
            <div className="h-48 rounded-xl bg-white/5" />
          </div>

          {/* Row 3: Trending + HoF + Stats */}
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-20 rounded-full bg-white/5" />
              ))}
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>
          <div className="col-span-2 lg:col-span-1 space-y-4">
            <div className="h-4 w-24 rounded bg-white/5" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/5" />
              ))}
            </div>
          </div>

          {/* Row 4: CTA */}
          <div className="col-span-2 lg:col-span-3">
            <div className="h-36 rounded-2xl bg-white/5" />
          </div>
        </div>
      </div>
    </>
  );
}
