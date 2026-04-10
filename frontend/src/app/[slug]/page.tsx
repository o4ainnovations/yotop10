import { Metadata } from 'next';
import PostDetailClient from './client';
import { API } from '@/lib/api';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug);
  
  // User profiles have a_ prefix
  if (slug.startsWith('a_')) {
    return {
      title: `User ${slug}`,
    };
  }
  
  try {
    const data = await API.getPost(slug);
    return {
      title: data.post.title,
      description: data.post.intro.substring(0, 160),
      alternates: {
        canonical: `https://yotop10.fun/${resolvedParams.slug}`,
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

  let items: Array<{ id: string; rank: number; title: string; justification: string; image_url?: string; source_url?: string; fire_count: number }> = [];
  
  try {
    const data = await API.getPost(resolvedParams.slug);
    items = data.items || [];
  } catch {
    // Items will be fetched client-side
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
      )}
      <PostDetailClient slug={String(resolvedParams.slug)} />
    </>
  );
}
