/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';

const pages = [
  {
    path: '/categories',
    title: 'Categories',
    description: 'Browse all categories to find top 10 lists on your favorite topics',
  },
  {
    path: '/c/movies',
    title: 'Category Feed (Example)',
    description: 'View posts filtered by a specific category (e.g., Movies)',
  },
  {
    path: '/a_test',
    title: 'User Profile',
    description: 'Example user profile page - demonstrates the anonymous profile system',
  },
];

export default function Home() {
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    getFingerprint().then(() => {
      API.getCurrentUser().then(setUser).catch(() => {});
    });
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>YoTop10 Platform</h1>
         {user && (
           <Link href={`/a/${user.username}`}>
             {user.username}
           </Link>
         )}
      </div>
      <p style={{ marginBottom: '30px' }}>
        An open Wikipedia-style platform for top 10 lists with a social UI.
        Anyone can browse, submit, and comment without creating an account.
      </p>

      <h2>Available Pages</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {pages.map((page) => (
          <li key={page.path} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '4px' }}>
            <Link href={page.path} style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {page.path} — {page.title}
            </Link>
            <p style={{ margin: '5px 0 0 0', color: '#666' }}>{page.description}</p>
          </li>
        ))}
      </ul>

      <hr style={{ margin: '30px 0' }} />

      <h3>API Endpoints (Backend)</h3>
      <ul>
        <li><code>GET /api/categories</code> — List all categories</li>
        <li><code>GET /api/categories/:slug</code> — Get single category</li>
        <li><code>GET /api/posts</code> — List approved posts</li>
        <li><code>GET /api/posts/:id</code> — Get single post with items and comments</li>
      </ul>
    </div>
  );
}
