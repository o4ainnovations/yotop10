import { Metadata } from 'next';
import PostHistoryClient from './client';
import { API } from '@/lib/api';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  try {
    const data = await API.getPost(resolvedParams.slug);
    return {
      title: `History: ${data.post.title}`,
    };
  } catch {
    return {
      title: 'Post History',
    };
  }
}

export default async function PostHistoryPage({ params }: PageProps) {
  const resolvedParams = await params;
  return <PostHistoryClient slug={resolvedParams.slug} />;
}
