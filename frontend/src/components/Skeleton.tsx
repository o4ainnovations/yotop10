'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/5 ${className}`}
      aria-hidden="true"
    />
  );
}

export function PostCardSkeleton() {
  return (
    <div className="flex-shrink-0 w-[calc(76vw-12px)] rounded-2xl border border-white/5 bg-white/5 p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-3 flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-3 flex-1" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-44 w-full" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-row gap-3 pl-4 py-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
