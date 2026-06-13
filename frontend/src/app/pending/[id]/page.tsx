import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import PostPendingClient from '@/components/PostPendingClient';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PendingPostPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) notFound();

  const cookieStore = await cookies();
  const fpCookie = cookieStore.get('device_fingerprint')?.value || '';
  const baseUrl = process.env.INTERNAL_API_URL || 'http://backend:8000/api';
  const headers: Record<string, string> = {};
  if (fpCookie) headers.Cookie = `device_fingerprint=${fpCookie}`;

  const fetchJson = async <T,>(url: string, fallback: T): Promise<T> => {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      if (!res.ok) return fallback;
      return await res.json();
    } catch { return fallback; }
  };

  const [postData, queueData] = await Promise.all([
    fetchJson<{ post?: { title: string; status: string; slug: string; rejection_reason?: string } }>(`${baseUrl}/posts/${id}`, {}),
    fetchJson<{ position: number }>(`${baseUrl}/posts/${id}/queue`, { position: 0 }),
  ]);

  const post = postData?.post;
  if (!post) notFound();

  // If already approved, redirect to the live post
  if (post.status === 'approved') redirect(`/${post.slug}`);

  const isRejected = post.status === 'rejected';

  return (
    <PostPendingClient
      title={post.title}
      rejectionReason={post.rejection_reason}
      isRejected={isRejected}
      postId={id}
      queueNumber={queueData.position}
    />
  );
}
