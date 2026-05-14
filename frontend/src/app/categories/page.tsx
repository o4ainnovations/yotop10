'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API, CategoriesResponse } from '@/lib/api';

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
      .then((data: CategoriesResponse) => {
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
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
        <header style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>YoTop10</h1>
          <nav style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', transition: 'var(--transition)' }}>Home</Link>
            <Link href="/categories" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>Categories</Link>
          </nav>
        </header>
        <main>
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h2 style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Error Loading Categories</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}><strong>Message:</strong> {error}</p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}><strong>API URL:</strong> {typeof window !== 'undefined' ? 'client-side' : 'server-side'}</p>
            <p style={{ color: 'var(--text-muted)' }}>Check browser console for more details.</p>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
        <header style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>YoTop10</h1>
          <nav style={{ display: 'flex', gap: '16px' }}>
            <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', transition: 'var(--transition)' }}>Home</Link>
            <Link href="/categories" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>Categories</Link>
          </nav>
        </header>
        <main>
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '15px' }}>Loading categories...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>YoTop10</h1>
        <nav style={{ display: 'flex', gap: '16px' }}>
          <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', transition: 'var(--transition)', fontWeight: 500 }}>Home</Link>
          <Link href="/categories" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 600 }}>Categories</Link>
        </nav>
      </header>
      <main>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '28px' }}>Categories</h1>
        {categories.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>No categories available.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {categories.map(cat => (
              <Link
                key={cat.id}
                href={`/c/${cat.slug}`}
                className="premium-card"
                style={{ padding: '24px', textDecoration: 'none', display: 'block' }}
              >
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </h2>
                {cat.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '12px', lineHeight: 1.5 }}>
                    {cat.description}
                  </p>
                )}
                <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500 }}>
                  {cat.post_count} {cat.post_count === 1 ? 'post' : 'posts'}
                </span>
                {cat.children.length > 0 && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-primary)' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Subcategories
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {cat.children.map(child => (
                        <li key={child.id}>
                          <Link
                            href={`/c/${child.slug}`}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: 'var(--radius-sm)',
                              textDecoration: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '13px',
                              transition: 'var(--transition)',
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.background = 'var(--accent-soft)';
                              e.currentTarget.style.color = 'var(--accent)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.background = 'var(--bg-tertiary)';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            <span>{child.name}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{child.post_count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
