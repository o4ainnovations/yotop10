import Link from 'next/link';
import { GlassSlab } from './GlassSlab';
import { BookmarkButton } from './BookmarkButton';
import { ShareButton } from './ShareButton';
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
      <GlassSlab
        post={post}
        rank={rank}
        actions={
          <>
            <BookmarkButton postId={post.id} />
            <ShareButton slug={post.slug} title={post.title} postId={post.id} />
          </>
        }
      />
    </Link>
  );
}
