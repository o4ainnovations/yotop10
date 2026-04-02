'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  is_featured: boolean;
  children: Array<{ id: string; name: string; slug: string; post_count: number }>;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    API.getCategories()
      .then((data: any) => {
        setCategories(data.categories || []);
        setError(null);
      })
      .catch(err => {
        console.error('[Categories] API error:', err);
        setError(err.message || 'Failed to load categories');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (error) {
    return (
      <div>
        <header>
          <h1>YoTop10</h1>
          <nav>
            <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
          </nav>
        </header>
        <main>
          <div style={{ color: 'red', padding: '20px', border: '1px solid red' }}>
            <h2>Error Loading Categories</h2>
            <p><strong>Message:</strong> {error}</p>
            <p><strong>API URL:</strong> {typeof window !== 'undefined' ? (window as any).__NEXT_DATA__?.props?.pageProps?.__NEXT_URL__ : 'server-side'}</p>
            <p>Check browser console for more details.</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <header>
          <h1>YoTop10</h1>
          <nav>
            <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
          </nav>
        </header>
        <main>
          <div style={{ padding: '20px' }}>
            <p>Loading... (if this persists, check console for errors)</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1>YoTop10</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
        </nav>
      </header>
      <main>
        <h1>Categories</h1>
        {categories.length === 0 ? (
          <p>No categories available.</p>
        ) : (
          <div>
            {categories.map(cat => (
              <div key={cat.id} style={{ marginBottom: '30px' }}>
                <h2>
                  {cat.icon} <Link href={`/c/${cat.slug}`}>{cat.name}</Link>
                </h2>
                <p>{cat.description}</p>
                <p>Posts: {cat.post_count}</p>
                {cat.children.length > 0 && (
                  <div style={{ marginLeft: '20px' }}>
                    <h3>Subcategories:</h3>
                    <ul>
                      {cat.children.map(child => (
                        <li key={child.id}>
                          <Link href={`/c/${child.slug}`}>{child.name}</Link> ({child.post_count} posts)
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}