'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface ListItem {
  id: string;
  rank: number;
  title: string;
  justification: string;
  image_url?: string;
  source_url?: string;
  fire_count: number;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

interface Post {
  id: string;
  title: string;
  post_type: string;
  intro: string;
  fire_count: number;
  comment_count: number;
  view_count: number;
  author_username: string;
  author_display_name: string;
  category: Category;
  created_at: string;
}

interface Comment {
  id: string;
  content: string;
  depth: number;
  fire_count: number;
  reply_count: number;
  author_username: string;
  author_display_name: string;
  created_at: string;
  list_item_id?: string;
  parent_comment_id?: string;
}

export default function PostDetailPage() {
  const params = useParams();
  const postId = params?.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    fetch(`/api/posts/${postId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setPost(data.post);
        setItems(data.items);
        setComments(data.comments);
      })
      .catch(() => setError('Failed to load post'))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <div>Loading...</div>;
  if (error || !post) return <div>{error || 'Post not found'}</div>;

  const rootComments = comments.filter(c => c.depth === 0);
  const repliesMap = comments.reduce((acc, c) => {
    if (c.depth > 0 && c.parent_comment_id) {
      if (!acc[c.parent_comment_id]) acc[c.parent_comment_id] = [];
      acc[c.parent_comment_id].push(c);
    }
    return acc;
  }, {} as Record<string, Comment[]>);

  const renderComment = (comment: Comment, depth: number = 0) => {
    if (depth >= 3) return null;
    const replies = repliesMap[comment.id] || [];
    return (
      <div key={comment.id} style={{ marginLeft: depth * 20 + 'px', borderLeft: '2px solid #ccc', paddingLeft: '10px', marginTop: '10px' }}>
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px' }}>
          <div><strong>{comment.author_display_name}</strong> - {new Date(comment.created_at).toLocaleDateString()}</div>
          <p>{comment.content}</p>
          <div>Fire: {comment.fire_count}</div>
        </div>
        {replies.map(r => renderComment(r, depth + 1))}
      </div>
    );
  };

  return (
    <div>
      <header>
        <h1>YoTop10</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/categories">Categories</Link> | <Link href="/submit">Submit</Link>
        </nav>
      </header>
      <main>
        <article>
          <p>{post.post_type} | {post.category?.name} | {new Date(post.created_at).toLocaleDateString()} | {post.view_count} views</p>
          <h1>{post.title}</h1>
          <p>By {post.author_display_name} | Fire: {post.fire_count}</p>
          <p>{post.intro}</p>
          <p><Link href={`/submit?counter_to=${post.id}`}>Submit Counter-List</Link> | <Link href={`/post/${post.id}/history`}>View History</Link></p>
        </article>
        <section>
          <h2>Ranked List</h2>
          {items.map(item => (
            <div key={item.id} style={{ marginBottom: '20px' }}>
              <h3>#{item.rank} {item.title}</h3>
              <p>{item.justification}</p>
              {item.image_url && <img src={item.image_url} alt={item.title} style={{ maxWidth: '300px' }} />}
              <p>Fire: {item.fire_count} | <Link href={`/post/${post.id}?item=${item.id}`}>Comment on this item</Link>{item.source_url && <span> | <a href={item.source_url} target="_blank" rel="noopener noreferrer">Source</a></span>}</p>
            </div>
          ))}
        </section>
        <section>
          <h2>Comments ({post.comment_count})</h2>
          {comments.length === 0 ? <p>No comments yet.</p> : rootComments.map(c => renderComment(c))}
        </section>
      </main>
      <footer>
        <p>YoTop10</p>
      </footer>
    </div>
  );
}