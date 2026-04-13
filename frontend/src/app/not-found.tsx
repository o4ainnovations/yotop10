'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <p><Link href="/">← Go back home</Link></p>
    </div>
  );
}
