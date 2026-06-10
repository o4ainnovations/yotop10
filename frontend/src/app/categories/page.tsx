import type { Metadata } from 'next';
import CategoriesClient from './client';

export const metadata: Metadata = {
  title: 'Categories — YoTop10',
  description: 'Browse all categories. Discover ranked lists, debates, fact drops, and more across every topic.',
  openGraph: {
    title: 'Categories — YoTop10',
    description: 'Browse all categories.',
  },
};

export default function CategoriesPage() {
  return <CategoriesClient />;
}
