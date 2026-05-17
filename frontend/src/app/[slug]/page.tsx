import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import PostDetailClient from './client';
import { API } from '@/lib/api';
import { RESERVED_ROUTES } from '@/lib/reservedRoutes';

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
        canonical: `https://yotop10.fun/${post.slug}`,
      },
      openGraph: {
        title: post.title,
        description: ogDescription,
        type: 'article',
        images: post.hero_image_url ? [post.hero_image_url] : [],
        url: `https://yotop10.fun/${post.slug}`,
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

  let items: Array<{ id: string; rank: number; title: string; justification: string; image_url?: string; source_url?: string }> = [];
  
  try {
    const data = await API.getPost(slug);
    items = data.items || [];
  } catch {
    notFound();
  }
  
  interface ListItemSchema {
    rank: number;
    title: string;
    justification: string;
  }
  
  const itemListSchema = items.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": items.map((item: ListItemSchema) => ({
      "@type": "ListItem",
      "position": item.rank,
      "name": item.title,
      "description": item.justification,
    }))
  } : null;
  
  return (
    <>
      {itemListSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema).replace(/<\//gi, '<\\/') }}
        />
      )}
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
        <PostDetailClient slug={slug} />
      </Suspense>
    </>
  );
}
