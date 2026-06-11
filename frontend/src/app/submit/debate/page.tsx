import type { Metadata } from 'next';
import DebateClient from './client';

export const metadata: Metadata = {
  title: 'Create a Debate — YoTop10',
  description: 'Set up two sides for the community to debate and vote on.',
};

export default function DebatePage() {
  return <DebateClient />;
}
