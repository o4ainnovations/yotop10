import { Metadata } from 'next';
import { Suspense } from 'react';
import ArticleDetailClient from './client';
import { API } from '@/lib/api';
import { absoluteUrl } from '@/lib/urls';

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = String(resolvedParams.slug);

  try {
    const data = await API.getArticle(slug);
    const article = data.article;

    const ageHours = (Date.now() - new Date(article.created_at).getTime()) / 3600000;
    const isStale = (article.comment_count === 0 || !article.comment_count) && (article.view_count === 0 || !article.view_count) && ageHours > 48;
    const isThin = ((article.body?.length || 0) < 200) && ageHours > 24;
    const isUnpublished = article.status !== 'approved';
    const isNoindex = isStale || isThin || isUnpublished;

    const description = article.body?.substring(0, 160) ?? '';
    const ogDescription = article.body?.substring(0, 200) ?? '';

    return {
      title: `${article.title} — YoTop10`,
      description,
      robots: {
        index: !isNoindex,
        follow: true,
      },
      alternates: {
        canonical: absoluteUrl(`/articles/${article.slug}`),
      },
      openGraph: {
        title: article.title,
        description: ogDescription,
        type: 'article',
        images: article.cover_image ? [article.cover_image] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title: article.title,
        description: ogDescription,
        images: article.cover_image ? [article.cover_image] : [],
      },
    };
  } catch {
    return {
      title: 'Article Not Found',
    };
  }
}

export default function ArticleDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>}>
      <ArticleDetailClient />
    </Suspense>
  );
}
