import type { Metadata } from 'next';
import SubmitClient from './client';

export const metadata: Metadata = {
  title: 'Submit a Ranked List — YoTop10',
  description: 'Create a ranked list, best of, or worst of post.',
};

type PageProps = {
  searchParams: Promise<{ type?: string; parent?: string }>;
};

export default async function RankedSubmitPage({ searchParams }: PageProps) {
  const { type, parent } = await searchParams;
  return <SubmitClient initialType={type as 'top_list' | 'best_of' | 'worst_of' | 'counter_list' | undefined} parentSlug={parent} />;
}
