'use client';

import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export default function NotFound({ message = 'The page you are looking for does not exist.' }: { message?: string }) {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>{message}</p>
      <p><Link href="/"><Icon name="ArrowLeft" size={16} className="inline mr-1" /> Go back home</Link></p>
    </div>
  );
}
