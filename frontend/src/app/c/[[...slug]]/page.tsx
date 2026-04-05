'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API, SingleCategoryResponse, PostsResponse, getBaseUrl } from '@/lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  post_count: number;
  children: Array<{ id: string; name: string; slug: string; post_count: number }>;
}

interface Post {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  intro: string;
  fire_count: number;
  comment_count: number;
  author_username: string;
  author_display_name: string;
  created_at: string;
}

export default function CategoryFeedPage() {
  const params = useParams();
  const slugParam = params?.slug;
  const slug = Array.isArray(slugParam) ? slugParam.join('/') : slugParam as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    if (!slug) return;

    Promise.all([
      API.getCategory(slug).then((data: SingleCategoryResponse) => data.category),
      API.getPosts({ category: slug, page: 1, limit: 20 }).then((data: PostsResponse) => data),
    ])
      .then(([catData, postsData]) => {
        setCategory(catData);
        setPosts(postsData.posts || []);
        setHasMore((postsData.pagination?.totalPages ?? 1) > 1);
      })
      .catch(err => {
        setError('Failed to load category');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const loadMore = () => {
    const nextPage = page + 1;
    const baseUrl = getBaseUrl();
    
    fetch(`${baseUrl}/posts?category=${slug}&page=${nextPage}&limit=20`)
      .then(res => res.json())
      .then(data => {
        setPosts(prev => [...prev, ...(data.posts || [])]);
        setPage(nextPage);
        setHasMore(data.pagination?.page < data.pagination?.totalPages);
      });
  };

  if (loading) return <div>Loading...</div>;
  if (error || !category) return <div>{error || 'Category not found'}</div>;

  return (
    <div>
      <header>
        <h1>YoTop10</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
        </nav>
      </header>
      <main>
        <h1>{category.icon} {category.name}</h1>
        <p>{category.description}</p>
        <p>{posts.length} of {category.post_count} posts</p>

        {category.children.length > 0 && (
          <div>
            <h3>Subcategories:</h3>
            <ul>
              {category.children.map(child => (
                <li key={child.id}>
                  <Link href={`/c/${child.slug}`}>{child.name}</Link> ({child.post_count})
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2>Posts in {category.name}</h2>
        {posts.length === 0 ? (
          <p>No posts yet in this category.</p>
        ) : (
          <div>
            {posts.map(post => (
              <div key={post.id} style={{ marginBottom: '20px', border: '1px solid #ccc', padding: '10px' }}>
                <h3><Link href={`/${post.slug}`}>{post.title}</Link></h3>
                <p>{post.post_type} | Fire: {post.fire_count} | Comments: {post.comment_count}</p>
                <p>By {post.author_display_name} - {new Date(post.created_at).toLocaleDateString()}</p>
                <p>{post.intro.substring(0, 200)}...</p>
              </div>
            ))}
            {hasMore && <button onClick={loadMore}>Load More</button>}
          </div>
        )}
      </main>
    </div>
  );
}