import { FeedSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] pt-14">
      <FeedSkeleton count={4} />
    </div>
  );
}
