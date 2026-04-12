'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { API } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';

const RESERVED_ROUTES = ['admin', 'api', 'login', 'search', 'settings', 'profile', 'categories', 'c', 'auth'];

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
  slug: string;
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
  spark_score: number;
  author_username: string;
  author_display_name: string;
  created_at: string;
  updated_at?: string;
  list_item_id?: string;
  parent_comment_id?: string;
  replies?: Comment[];
}

interface ReplyFormState {
  [commentId: string]: {
    content: string;
    submitting: boolean;
  };
}

export default function PostDetailClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const itemParam = searchParams?.get('item');
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingComments, setRefreshingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyForms, setReplyForms] = useState<ReplyFormState>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemParam);
  
  const [reacting, setReacting] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());

  // Route guard - reserved routes should not be treated as posts
  if (RESERVED_ROUTES.includes(slug)) {
    notFound();
  }

  const fetchComments = useCallback(async () => {
    if (!slug || slug === 'undefined') return;
    
    // Only show full page loading on initial load, not on refresh
    if (comments.length === 0) {
      setLoading(true);
    } else {
      setRefreshingComments(true);
    }

    try {
      const [postData, commentsData] = await Promise.all([
        API.getPost(slug),
        API.getComments(slug),
      ]);
      
      setPost(postData.post);
      setItems(postData.items);
      setComments(commentsData.comments);
      setError(null);

      // Load user reaction states
      const fingerprint = await getFingerprint();
      const allTargets = commentsData.comments.map((c: Comment) => ({ type: 'comment', id: c.id }));

      try {
        const reactionState: any = await API.getReactionState(allTargets);
        const reactedIds = new Set<string>(reactionState.targets.filter((t: any) => t.user_reacted).map((t: any) => String(t.id)));
        setUserReactions(reactedIds);
      } catch (reactionErr) {
        console.error('Failed to load reaction states:', reactionErr);
      }
    } catch (err) {
      console.error('Failed to load post:', err);
      setError('Failed to load post');
    } finally {
      setLoading(false);
      setRefreshingComments(false);
    }
  }, [slug, comments.length]);

  useEffect(() => {
    if (!slug || slug === 'undefined') return;
    
    API.getPost(slug)
      .then((data) => {
        const typedData = data as { post: Post; items: ListItem[] };
        setPost(typedData.post);
        setItems(typedData.items || []);
      })
      .catch(() => setError('Failed to load post'))
      .finally(() => setLoading(false));
      
    fetchComments();
  }, [slug, fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || submitting) return;

    setSubmitting(true);
    
    try {
      await API.addComment(slug, commentContent, undefined, selectedItemId || undefined);
      setCommentContent('');
      setSelectedItemId(null);
      setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      fetchComments();
      commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      alert('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplyContentChange = (commentId: string, content: string) => {
    setReplyForms(prev => ({
      ...prev,
      [commentId]: { ...prev[commentId], content }
    }));
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    const formState = replyForms[parentCommentId];
    if (!formState?.content?.trim() || formState.submitting) return;

    setReplyForms(prev => ({
      ...prev,
      [parentCommentId]: { ...prev[parentCommentId], submitting: true }
    }));
    
    try {
      await API.addComment(slug, formState.content, parentCommentId, undefined);
      setReplyForms(prev => ({
        ...prev,
        [parentCommentId]: { content: '', submitting: false }
      }));
      setReplyTo(null);
      setPost(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      fetchComments();
    } catch {
      alert('Failed to post reply');
      setReplyForms(prev => ({
        ...prev,
        [parentCommentId]: { ...prev[parentCommentId], submitting: false }
      }));
    }
  };



  const handleReaction = async (targetType: 'comment', targetId: string) => {
    if (reacting) return;
    setReacting(true);
    
    const fingerprint = await getFingerprint();
    
    try {
      const data = await API.toggleReaction(targetType, targetId, fingerprint) as { fire_count: number; user_reacted: boolean };
      
      // Update fire counts
      if (targetType === 'comment') {
        setComments(prev => updateCommentFireCount(prev, targetId, data.fire_count));
      }

      // Update user reaction state
      setUserReactions(prev => {
        const next = new Set(prev);
        if (data.user_reacted) {
          next.add(targetId);
        } else {
          next.delete(targetId);
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to react:', err);
      alert('Failed to react');
    } finally {
      setReacting(false);
    }
  };

  const updateCommentFireCount = (comments: Comment[], targetId: string, newCount: number): Comment[] => {
    return comments.map(c => ({
      ...c,
      fire_count: c.id === targetId ? newCount : c.fire_count,
      replies: c.replies ? updateCommentFireCount(c.replies, targetId, newCount) : c.replies,
    }));
  };

  const getItemRank = (listItemId: string): number | null => {
    const item = items.find(i => i.id === listItemId);
    return item ? item.rank : null;
  };

  const toggleItemDropdown = (itemId: string) => {
    setSelectedItemId(itemId);
    commentsSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => commentTextareaRef.current?.focus(), 300);
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const isReplying = replyTo === comment.id;
    const replyForm = replyForms[comment.id] || { content: '', submitting: false };
    const itemRank = comment.list_item_id ? getItemRank(comment.list_item_id) : null;
    
    // Cap indentation at 48px for depth >= 3
    const cappedIndent = Math.min(depth, 3) * 16;
    const showThreadIndicator = depth > 3;
    
    return (
      <div key={comment.id} style={{ marginLeft: cappedIndent + 'px', borderLeft: '2px solid #ccc', paddingLeft: '10px', marginTop: '10px' }}>
        {showThreadIndicator && <span style={{ marginLeft: '-16px', color: '#888', position: 'absolute' }}>↳</span>}
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', fontSize: depth > 0 ? '14px' : '16px' }}>
          <div>
            <strong>{comment.author_display_name}</strong>
            <span style={{ color: '#888', fontSize: '12px', marginLeft: '8px' }}>
              ✨ {comment.spark_score.toFixed(2)}
            </span>
            {comment.list_item_id && itemRank && (
              <span style={{ backgroundColor: '#e0f0ff', padding: '2px 6px', borderRadius: '3px', fontSize: '12px', marginLeft: '8px' }}>
                📌 On item #{itemRank}
              </span>
            )}
            {comment.parent_comment_id && (
              <span style={{ color: '#666', fontSize: '12px', marginLeft: '8px' }}>
                ↩️ Reply
              </span>
            )}
            - {new Date(comment.created_at).toLocaleDateString()}
          </div>
          <p>{comment.content}</p>
          <div style={{ fontSize: '12px', color: '#666' }}>
            <button 
              onClick={() => handleReaction('comment', comment.id)}
              style={{ 
                background: userReactions.has(comment.id) ? '#fff3e0' : 'none', 
                border: userReactions.has(comment.id) ? '1px solid #ff9800' : 'none', 
                cursor: 'pointer', 
                marginRight: '10px',
                borderRadius: '3px',
                padding: '2px 6px',
                fontWeight: userReactions.has(comment.id) ? 'bold' : 'normal',
              }}
              disabled={reacting}
            >
              🔥 {comment.fire_count}
            </button>
            {depth < 10 && (
              <button 
                onClick={() => setReplyTo(isReplying ? null : comment.id)}
                style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer' }}
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            )}
          </div>
          
          {isReplying && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff', borderRadius: '5px', border: '1px solid #ddd' }}>
              <textarea
                value={replyForm.content}
                onChange={(e) => handleReplyContentChange(comment.id, e.target.value)}
                placeholder={`Reply to ${comment.author_display_name}...`}
                style={{ width: '100%', minHeight: '60px', padding: '8px', marginBottom: '8px' }}
                maxLength={2000}
              />
              <button 
                onClick={() => handleSubmitReply(comment.id)}
                disabled={replyForm.submitting || !replyForm.content.trim()}
                style={{ padding: '8px 16px', backgroundColor: replyForm.submitting ? '#ccc' : '#0066cc', color: 'white', border: 'none', borderRadius: '5px', cursor: replyForm.submitting ? 'not-allowed' : 'pointer' }}
              >
                {replyForm.submitting ? 'Posting...' : 'Submit Reply'}
              </button>
            </div>
          )}
        </div>
        {comment.replies?.map(r => renderComment(r, depth + 1))}
      </div>
    );
  };

  if (loading) return <div>Loading...</div>;
  if (error || !post) return <div>{error || 'Post not found'}</div>;

  const rootComments = comments.filter(c => c.depth === 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h1>YoTop10</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
        </nav>
      </header>
      
      <main>
        <article style={{ marginBottom: '30px' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>
            {post.post_type} | {post.category?.name} | {new Date(post.created_at).toLocaleDateString()} | {post.view_count} views
          </p>
          <h1>{post.title}</h1>
          <p>By {post.author_display_name}</p>
          <p>{post.intro}</p>
          <p>
            
            <Link href={`/${slug}/history`}>View History</Link>
          </p>
        </article>
        
        <section style={{ marginBottom: '30px' }}>
          <h2>Ranked List</h2>
          {items.map(item => (
            <div key={item.id} style={{ marginBottom: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3>#{item.rank} {item.title}</h3>
                <p>{item.justification}</p>
                {item.image_url && <Image src={item.image_url} alt={item.title} style={{ maxWidth: '300px' }} width={300} height={200} unoptimized />}
                {item.source_url && <p style={{ fontSize: '14px', color: '#666' }}><a href={item.source_url} target="_blank" rel="noopener noreferrer">Source</a></p>}
              </div>
              <div style={{ position: 'relative', marginLeft: '10px' }}>
                <button 
                  onClick={() => toggleItemDropdown(item.id)}
                  style={{ background: 'none', border: '1px solid #ccc', padding: '5px 8px', cursor: 'pointer', borderRadius: '3px', fontSize: '12px', lineHeight: 1, fontWeight: 'bold' }}
                  title="Comment on this item"
                >
                  v
                </button>
              </div>
            </div>
          ))}
        </section>
        
        <section ref={commentsSectionRef}>
          <h2>Comments ({post.comment_count}) {refreshingComments && <span style={{ fontSize: '14px', color: '#666' }}>⟳</span>}</h2>
          
          <div style={{ marginBottom: '15px' }}>
            <label>Filter: </label>
            <select 
              value={selectedItemId || ''} 
              onChange={(e) => {
                setSelectedItemId(e.target.value || null);
              }}
              style={{ padding: '5px' }}
            >
              <option value="">All Comments</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>On #{item.rank} - {item.title}</option>
              ))}
            </select>
          </div>
          
          <form onSubmit={handleSubmitComment} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
            <textarea
              ref={commentTextareaRef}
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              style={{ width: '100%', minHeight: '80px', padding: '10px', marginBottom: '10px' }}
              maxLength={2000}
            />
            <button 
              type="submit" 
              disabled={submitting || !commentContent.trim()}
              style={{ padding: '10px 20px', backgroundColor: submitting ? '#ccc' : '#0066cc', color: 'white', border: 'none', borderRadius: '5px', cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
          
          {comments.length === 0 ? (
            <p>No comments yet. Be the first to comment!</p>
          ) : (
            rootComments.map(c => renderComment(c))
          )}
        </section>
      </main>
      
      <footer style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '10px', textAlign: 'center', color: '#666' }}>
        <p>YoTop10 - Open Platform for Top 10 Lists</p>
      </footer>
    </div>
  );
}
