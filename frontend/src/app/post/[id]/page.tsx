'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API, getBaseUrl } from '@/lib/api';

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

interface ItemDropdownState {
  [itemId: string]: boolean;
}

export default function PostDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const postId = params?.id as string;
  const itemParam = searchParams?.get('item');

  const [post, setPost] = useState<Post | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyForms, setReplyForms] = useState<ReplyFormState>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemParam);
  const [itemDropdowns, setItemDropdowns] = useState<ItemDropdownState>({});
  
  const [reacting, setReacting] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    
    try {
      const data = await API.getComments(postId);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    
    API.getPost(postId)
      .then((data) => {
        const typedData = data as { post: Post; items: ListItem[] };
        setPost(typedData.post);
        setItems(typedData.items || []);
      })
      .catch(() => setError('Failed to load post'))
      .finally(() => setLoading(false));
      
    fetchComments();
  }, [postId, fetchComments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || submitting) return;

    setSubmitting(true);
    
    try {
      await API.addComment(postId, commentContent, undefined, selectedItemId || undefined);
      setCommentContent('');
      setSelectedItemId(null);
      setPost((prev: any) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      fetchComments();
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
      await API.addComment(postId, formState.content, parentCommentId, undefined);
      setReplyForms(prev => ({
        ...prev,
        [parentCommentId]: { content: '', submitting: false }
      }));
      setReplyTo(null);
      setPost((prev: any) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : null);
      fetchComments();
    } catch {
      alert('Failed to post reply');
      setReplyForms(prev => ({
        ...prev,
        [parentCommentId]: { ...prev[parentCommentId], submitting: false }
      }));
    }
  };

  const getOrCreateFingerprint = (): string => {
    let fp = localStorage.getItem('yotop10_fp');
    if (!fp) {
      fp = 'fp_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('yotop10_fp', fp);
    }
    return fp;
  };

  const handleReaction = async (targetType: 'post' | 'list_item' | 'comment', targetId: string) => {
    if (reacting) return;
    setReacting(true);
    
    const key = `${targetType}-${targetId}`;
    const fingerprint = getOrCreateFingerprint();
    
    try {
      console.log('Sending reaction request:', { targetType, targetId, fingerprint });
      const data: any = await API.toggleReaction(targetType, targetId, fingerprint);
      console.log('Reaction response:', data);
      
      if (targetType === 'comment') {
        setComments(prev => updateCommentFireCount(prev, targetId, data.fire_count));
      } else if (targetType === 'post') {
        setPost((prev: any) => prev ? { ...prev, fire_count: data.fire_count } : null);
      }
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
    setItemDropdowns(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    if (depth >= 3) return null;
    
    const isReplying = replyTo === comment.id;
    const replyForm = replyForms[comment.id] || { content: '', submitting: false };
    const itemRank = comment.list_item_id ? getItemRank(comment.list_item_id) : null;
    
    return (
      <div key={comment.id} style={{ marginLeft: depth * 20 + 'px', borderLeft: '2px solid #ccc', paddingLeft: '10px', marginTop: '10px' }}>
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '5px', fontSize: depth > 0 ? '14px' : '16px' }}>
          <div>
            <strong>{comment.author_display_name}</strong> 
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }}
              disabled={reacting}
            >
              🔥 {comment.fire_count}
            </button>
            {depth < 2 && (
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
            <button onClick={() => handleReaction('post', post.id)} disabled={reacting} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '10px' }}>
              🔥 {post.fire_count}
            </button>
            <Link href={`/post/${post.id}/history`}>View History</Link>
          </p>
        </article>
        
        <section style={{ marginBottom: '30px' }}>
          <h2>Ranked List</h2>
          {items.map(item => (
            <div key={item.id} style={{ marginBottom: '20px', border: '1px solid #eee', padding: '15px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3>#{item.rank} {item.title}</h3>
                <p>{item.justification}</p>
                {item.image_url && <img src={item.image_url} alt={item.title} style={{ maxWidth: '300px' }} />}
                <p style={{ fontSize: '14px', color: '#666' }}>
                  <button 
                    onClick={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}
                    style={{ background: selectedItemId === item.id ? '#e0f0ff' : 'none', border: '1px solid #ccc', marginLeft: '5px', padding: '2px 8px', cursor: 'pointer' }}
                  >
                    {selectedItemId === item.id ? '✓ Commenting on this item' : 'Comment on this item'}
                  </button>
                  {item.source_url && <span> | <a href={item.source_url} target="_blank" rel="noopener noreferrer">Source</a></span>}
                </p>
              </div>
              <div style={{ position: 'relative', marginLeft: '10px' }}>
                <button 
                  onClick={() => toggleItemDropdown(item.id)}
                  style={{ background: 'none', border: '1px solid #ccc', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}
                  title="More options"
                >
                  ⋮
                </button>
                {itemDropdowns[item.id] && (
                  <div style={{ position: 'absolute', right: 0, top: '100%', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '150px' }}>
                    <button 
                      onClick={() => {
                        setSelectedItemId(item.id);
                        setItemDropdowns(prev => ({ ...prev, [item.id]: false }));
                      }}
                      style={{ display: 'block', width: '100%', padding: '10px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    >
                      📌 Comment on this item
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
        
        <section>
          <h2>Comments ({post.comment_count})</h2>
          
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
            {selectedItemId && (
              <div style={{ marginBottom: '10px', color: '#0066cc' }}>
                📌 Commenting on item #{items.find(i => i.id === selectedItemId)?.rank}
              </div>
            )}
            <textarea
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