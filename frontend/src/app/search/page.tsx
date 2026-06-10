import type { Metadata } from 'next';
import SearchClient from './client';

export const metadata: Metadata = {
  title: 'Search — YoTop10',
  description: 'Search ranked lists, debates, fact drops, and articles across all categories.',
  openGraph: {
    title: 'Search — YoTop10',
    description: 'Search ranked lists, debates, fact drops, and articles.',
  },
};

export default function SearchPage() {
  return <SearchClient />;
}
