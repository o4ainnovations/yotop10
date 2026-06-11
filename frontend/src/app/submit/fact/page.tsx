import type { Metadata } from 'next';
import FactClient from './client';

export const metadata: Metadata = {
  title: 'Drop a Fact — YoTop10',
  description: 'Share a surprising fact with a verifiable source.',
};

export default function FactPage() {
  return <FactClient />;
}
