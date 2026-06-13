import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import PostDetailClient from './client';
import PostPendingClient from '@/components/PostPendingClient';
import { API } from '@/lib/api';
import { RESERVED_ROUTES } from '@/lib/reservedRoutes';
import { absoluteUrl } from '@/lib/urls';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug);

  if (RESERVED_ROUTES.has(slug)) {
    return { title: 'Post Not Found' };
  }
  
  try {
    const data = await API.getPost(slug);
    const post = data.post;
    const description = post.intro?.substring(0, 160) ?? '';
    const ogDescription = post.intro?.substring(0, 200) ?? '';

    // SEO Indexing Guard
    const ageHours = (Date.now() - new Date(post.created_at).getTime()) / 3600000;
    const isStale = (post.comment_count === 0 || !post.comment_count) && (post.view_count === 0 || !post.view_count) && ageHours > 48;
    const isThin = ((post.intro?.length || 0) < 100) && ageHours > 24;
    const isUnpublished = post.status !== 'approved';
    const isNoindex = isStale || isThin || isUnpublished;

    return {
      title: `${post.title} — YoTop10`,
      description,
      robots: {
        index: !isNoindex,
        follow: true,
      },
      alternates: {
        canonical: absoluteUrl(`/${post.slug}`),
      },
      openGraph: {
        title: post.title,
        description: ogDescription,
        type: 'article',
        images: post.hero_image_url ? [post.hero_image_url] : [],
        url: absoluteUrl(`/${post.slug}`),
      },
      twitter: {
        card: 'summary_large_image',
        title: post.title,
        description: ogDescription,
        images: post.hero_image_url ? [post.hero_image_url] : [],
      },
    };
  } catch {
    return {
      title: 'Post Not Found',
    };
  }
}



export default async function PostDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug);

  if (RESERVED_ROUTES.has(slug)) {
    notFound();
  }

  // Forward device_fingerprint cookie so backend can identify the viewer
  const cookieStore = await cookies();
  const fpCookie = cookieStore.get('device_fingerprint')?.value || '';
  const baseUrl = process.env.INTERNAL_API_URL || 'http://backend:8000/api';

  const headers: Record<string, string> = {};
  if (fpCookie) headers.Cookie = `device_fingerprint=${fpCookie}`;

  async function apiFetchWithCookie<T>(endpoint: string): Promise<T | null> {
    try {
      const res = await fetch(`${baseUrl}${endpoint}`, { headers, cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  try {
    interface PostResponse { post: import('@/lib/api/types').Post; items: unknown[] }
    interface CommentsResponse { comments: unknown[] }
    const [postData, commentsData] = await Promise.all([
      apiFetchWithCookie<PostResponse>(`/posts/${encodeURIComponent(slug)}`),
      apiFetchWithCookie<CommentsResponse>(`/posts/${encodeURIComponent(slug)}/comments?limit=50`),
    ]);

    if (!postData || !postData.post) { notFound(); return; }

    const post = postData.post;
    const items = (postData.items || []) as unknown as { id: string; rank: number; title: string; justification: string }[];
    const comments = (commentsData?.comments || []) as unknown as { id: string; content: string; depth: number; fire_count: number; reply_count: number; spark_score: number; author_username: string; author_display_name: string; created_at: string; updated_at?: string; list_item_id?: string; parent_comment_id?: string; replies?: never[] }[];
    const pStatus = post.status;

    // Show pending/rejected page instead of full post
    if (pStatus && pStatus !== 'approved') {
      return (
        <PostPendingClient
          title={post.title}
          rejectionReason={post.rejection_reason}
          isRejected={pStatus === 'rejected'}
        />
      );
    }

    const ld = items.length > 0 ? {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "ItemList",
          "@id": absoluteUrl(`/${post.slug}#list`),
          "name": post.title,
          "description": post.intro?.substring(0, 200) || '',
          "numberOfItems": items.length,
          "itemListElement": items.map((item, idx) => ({
            "@type": "ListItem",
            "position": idx + 1,
            "item": {
              "@type": "Thing",
              "name": item.title,
              "description": ((item.justification as string) || '').substring(0, 300),
            },
          })),
          "author": { "@type": "Person", "name": post.author_display_name || post.author_username, "url": absoluteUrl(`/a/${post.author_username.replace(/^a_/, '')}`) },
          "datePublished": post.created_at,
          "image": post.hero_image_url || undefined,
        },
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": absoluteUrl('/') },
            { "@type": "ListItem", "position": 2, "name": post.category_name || post.category_slug, "item": absoluteUrl(`/c/${post.category_slug}`) },
            { "@type": "ListItem", "position": 3, "name": post.title, "item": absoluteUrl(`/${post.slug}`) },
          ],
        },
      ],
    } : null;

    return (
      <>
        {ld && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/<\//gi, '<\\/') }}
          />
        )}
        <PostDetailClient
          slug={slug}
          initialPost={post}
          initialItems={items}
          initialComments={comments}
        />
      </>
    );
  } catch {
    notFound();
  }
}
