export function HomeSkeleton() {
  return (
    <div className="block sm:hidden px-3 pt-6 space-y-5 animate-pulse">
      {/* Carousel skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-white/5" />
        <div className="flex gap-3 overflow-hidden">
          <div className="h-44 w-[76vw] shrink-0 rounded-2xl bg-white/5" />
          <div className="h-44 w-[76vw] shrink-0 rounded-2xl bg-white/5" />
        </div>
      </div>

      {/* Debates skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-20 rounded bg-white/5" />
        <div className="h-28 rounded-xl bg-white/5" />
        <div className="h-28 rounded-xl bg-white/5" />
      </div>

      {/* Categories skeleton */}
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

      {/* Fact drop skeleton */}
      <div className="space-y-2">
        <div className="h-20 rounded-xl bg-white/5" />
      </div>

      {/* Articles skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 rounded bg-white/5" />
        <div className="h-24 rounded-xl bg-white/5" />
        <div className="h-24 rounded-xl bg-white/5" />
      </div>
    </div>
  );
}
