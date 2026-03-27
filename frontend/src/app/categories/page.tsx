'use client';

import { useState, useEffect } from 'react';

interface ChildCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  is_featured: boolean;
  children: ChildCategory[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setCategories(data.categories);
      })
      .catch(err => {
        setError('Failed to load categories');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <header>
        <h1>YoTop10</h1>
        <nav>
          <a href="/">Home</a> | <a href="/categories">Categories</a> | <a href="/submit">Submit</a>
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
                  {cat.icon} <a href={`/c/${cat.slug}`}>{cat.name}</a>
                </h2>
                <p>{cat.description}</p>
                <p>Posts: {cat.post_count}</p>
                {cat.children.length > 0 && (
                  <div style={{ marginLeft: '20px' }}>
                    <h3>Subcategories:</h3>
                    <ul>
                      {cat.children.map(child => (
                        <li key={child.id}>
                          <a href={`/c/${child.slug}`}>{child.name}</a> ({child.post_count} posts)
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