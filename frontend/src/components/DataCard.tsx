import Link from 'next/link';
import { GlassSlab } from './GlassSlab';
import type { Post } from '@/lib/api/types';

export function DataCard({
  post,
  rank,
}: {
  post: Post;
  rank?: number;
}) {
  return (
    <Link href={`/${post.slug}`} className="block group">
      <GlassSlab post={post} rank={rank} />
    </Link>
  );
}
