import type { Metadata } from 'next';
import NewPostClient from './client';

export const metadata: Metadata = {
  title: 'Create New Post — YoTop10',
  description: 'Choose a post type to get started: ranked list, debate, fact drop, best of, or worst of.',
  openGraph: {
    title: 'Create New Post — YoTop10',
    description: 'Choose a post type to get started.',
  },
};

export default function NewPostPage() {
  return <NewPostClient />;
}
