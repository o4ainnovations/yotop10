'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import NotFound from '@/components/NotFound';
import Link from 'next/link';
import Image from 'next/image';
import { API } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';

const RESERVED_ROUTES = ['admin', 'api', 'login', 'search', 'settings', 'profile', 'categories', 'c', 'auth'];

interface ListItem {
  id: string;
  rank: number;
  title: string;
  justification: string;
  image_url?: string;
  source_url?: string;
}

interface Post {
  id: string;
  slug: string;
  title: string;
  post_type: string;
  intro: string;
  comment_count: number;
  view_count: number;
  author_username: string;
  author_display_name: string;
  category_slug: string;
  format: 'list_only' | 'hero_list' | 'full_list';
  hero_image_url?: string | null;
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

  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyForms, setReplyForms] = useState<ReplyFormState>({});
  const [selectedItemId, setSelectedItemId] = useState<string | null>(itemParam);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const fetchComments = useCallback(async () => {
    if (!slug || slug === 'undefined') return;

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

      if (!mountedRef.current) return;

      setPost(postData.post);
      setItems(postData.items as ListItem[]);
      setComments(commentsData.comments);

      const allTargets = commentsData.comments.map((c: Comment) => ({ type: 'comment', id: c.id }));
      try {
        const reactionState = await API.getReactionState(allTargets) as {
          targets: Array<{ type: string; id: string; user_reacted: boolean }>
        };
        if (mountedRef.current) {
          const reactedIds = new Set<string>(reactionState.targets.filter(t => t.user_reacted).map(t => String(t.id)));
          setUserReactions(reactedIds);
        }
      } catch {
        // Non-critical
      }
    } catch {
      setCommentError('Failed to react. Please try again.');
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshingComments(false);
      }
    }
  }, [slug, comments.length]);

  useEffect(() => {
    mountedRef.current = true;
    if (!slug || slug === 'undefined') return;

    fetchComments();
    return () => { mountedRef.current = false; };
  }, [slug, fetchComments]);

  if (RESERVED_ROUTES.includes(slug)) {
    return <NotFound />;
  }

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
      setCommentError('Failed to post comment. Please try again.');
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
      setReplyForms(prev => ({
        ...prev,
        [parentCommentId]: { ...prev[parentCommentId], submitting: false }
      }));
    }
  };

  const handleReaction = async (targetType: 'comment', targetId: string) => {
    if (reacting) return;
    setReacting(true);

    try {
      const data = await API.toggleReaction(targetType, targetId) as { fire_count: number; user_reacted: boolean };

      if (targetType === 'comment') {
        setComments(prev => updateCommentFireCount(prev, targetId, data.fire_count));
      }

      setUserReactions(prev => {
        const next = new Set(prev);
        if (data.user_reacted) {
          next.add(targetId);
        } else {
          next.delete(targetId);
        }
        return next;
      });
    } catch {
      setCommentError('Failed to react. Please try again.');
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

    const cappedIndent = Math.min(depth, 3) * 16;
    const showThreadIndicator = depth > 3;

    return (
      <div key={comment.id} style={{
        marginLeft: cappedIndent + 'px',
        borderLeft: '2px solid var(--border-primary)',
        paddingLeft: '12px',
        marginTop: '12px',
      }}>
        {showThreadIndicator && (
          <span style={{
            position: 'absolute',
            marginLeft: '-22px',
            marginTop: '2px',
          }}>
            <Icon name="CornerDownRight" size={12} color="var(--text-muted)" />
          </span>
        )}
        <div style={{
          background: 'var(--bg-tertiary)',
          padding: '14px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: depth > 0 ? '14px' : '15px',
          border: '1px solid var(--border-primary)',
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '6px 10px',
            marginBottom: '8px',
          }}>
            <strong style={{
              color: 'var(--text-primary)',
              fontFamily: '"Geist Mono", monospace',
              fontSize: depth > 0 ? '13px' : '14px',
            }}>
              {comment.author_display_name}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="Sparkles" size={12} color="#f57c00" /> {comment.spark_score.toFixed(2)}
            </span>
            {comment.list_item_id && itemRank && (
              <span style={{
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '11px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Icon name="Pin" size={11} /> On item #{itemRank}
              </span>
            )}
            {comment.parent_comment_id && (
              <span style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Icon name="Reply" size={11} /> Reply
              </span>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          <p style={{
            margin: '0 0 10px 0',
            color: 'var(--text-primary)',
            lineHeight: 1.6,
            fontSize: depth > 0 ? '14px' : '15px',
          }}>
            {comment.content}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => handleReaction('comment', comment.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: userReactions.has(comment.id) ? 'var(--accent-soft)' : 'transparent',
                border: userReactions.has(comment.id) ? '1px solid var(--accent)' : '1px solid transparent',
                cursor: 'pointer',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: userReactions.has(comment.id) ? 600 : 400,
                color: userReactions.has(comment.id) ? 'var(--accent)' : 'var(--text-muted)',
                transition: 'all var(--transition)',
              }}
              disabled={reacting}
            >
              <Icon name="Flame" size={14} color="#e65100" /> {comment.fire_count}
            </button>
            {depth < 10 && (
              <button
                onClick={() => setReplyTo(isReplying ? null : comment.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-soft)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            )}
          </div>

          {isReplying && (
            <div style={{
              marginTop: '12px',
              padding: '14px',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)',
            }}>
              <textarea
                value={replyForm.content}
                onChange={(e) => handleReplyContentChange(comment.id, e.target.value)}
                placeholder={`Reply to ${comment.author_display_name}...`}
                style={{
                  width: '100%',
                  minHeight: '60px',
                  padding: '11px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1.5px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'inherit',
                  marginBottom: '10px',
                  resize: 'vertical',
                  transition: 'border-color var(--transition)',
                }}
                maxLength={2000}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                }}
              />
              <button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={replyForm.submitting || !replyForm.content.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 22px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: replyForm.submitting ? 'not-allowed' : 'pointer',
                  background: replyForm.submitting ? 'var(--border-primary)' : 'var(--accent-gradient)',
                  color: replyForm.submitting ? 'var(--text-muted)' : '#fff',
                  transition: 'all var(--transition)',
                  opacity: replyForm.submitting ? 0.7 : 1,
                }}
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-muted)',
        fontSize: '16px',
      }}>
        Loading...
      </div>
    );
  }

  if (!post) return <NotFound message="Page does not exist." />;

  const rootComments = comments.filter(c => c.depth === 0);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-geist-sans), sans-serif',
    }}>
      {/* Navigation Header */}
      <header style={{
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-primary)',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{
          maxWidth: '940px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Link
            href="/"
            style={{
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '3px',
              textDecoration: 'none',
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            YOTOP10
          </Link>
          <nav style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
            <Link
              href="/"
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Home
            </Link>
            <Link
              href="/categories"
              style={{
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                transition: 'color var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Categories
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: '940px', margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* Article Header */}
        <article style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: '40px',
          marginBottom: '32px',
        }}>
          {/* Post metadata */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px 16px',
            marginBottom: '16px',
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}>
            <span style={{
              textTransform: 'capitalize',
              padding: '2px 8px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)',
              fontSize: '12px',
              fontWeight: 500,
            }}>
              {post.post_type}
            </span>
            <Link
              href={`/c/${post.category_slug}`}
              style={{
                color: 'var(--accent)',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'opacity var(--transition)',
              }}
            >
              {post.category_slug}
            </Link>
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
            <span>{post.view_count} views</span>
          </div>

          <h1 style={{
            fontSize: '30px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 16px 0',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
          }}>
            {post.title}
          </h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '16px',
            lineHeight: 1.7,
            margin: '0 0 16px 0',
          }}>
            {post.intro}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <span style={{
              color: 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: 500,
            }}>
              By <Link
                href={`/a/${post.author_username.replace(/^a_/, '')}`}
                style={{
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {post.author_display_name}
              </Link>
            </span>
            <Link
              href={`/${slug}/history`}
              style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                textDecoration: 'none',
                transition: 'color var(--transition)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              View History <Icon name="ArrowRight" size={12} />
            </Link>
          </div>
        </article>

        {/* Ranked List */}
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 20px 0',
            letterSpacing: '-0.01em',
          }}>
            Ranked List
          </h2>

          {post.hero_image_url && (post.format === 'hero_list' || post.format === 'full_list') && (
            <div style={{
              marginBottom: '24px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-primary)',
            }}>
              <Image
                src={post.hero_image_url}
                alt={post.title}
                width={1200}
                height={675}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                unoptimized
              />
            </div>
          )}

          {items.map(item => {
            const hasImage = !!(item.image_url && (post.format === 'hero_list' || post.format === 'full_list'));
            return (
              <div key={item.id} style={{
                marginBottom: '16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                transition: 'box-shadow var(--transition), border-color var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
              >
                {hasImage && (
                  <div style={{
                    flexShrink: 0,
                    width: '200px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-primary)',
                  }}>
                    <Image
                      src={item.image_url!}
                      alt={item.title}
                      width={400}
                      height={280}
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                      unoptimized
                    />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    lineHeight: 1.4,
                  }}>
                    #{item.rank} {item.title}
                  </h3>
                  <p style={{
                    margin: '0 0 10px 0',
                    lineHeight: 1.7,
                    color: 'var(--text-secondary)',
                    fontSize: '15px',
                  }}>
                    {item.justification}
                  </p>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '13px',
                        color: 'var(--accent)',
                        textDecoration: 'none',
                        fontWeight: 500,
                        transition: 'opacity var(--transition)',
                      }}
                    >
                      Source <Icon name="ExternalLink" size={11} />
                    </a>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <button
                    onClick={() => toggleItemDropdown(item.id)}
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      lineHeight: 1,
                      color: 'var(--text-secondary)',
                      fontWeight: 600,
                      transition: 'all var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title="Comment on this item"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.color = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <Icon name="ChevronDown" size={14} /> Comment
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        {/* Comments Section */}
        <section ref={commentsSectionRef} style={{
          borderTop: '2px solid var(--border-primary)',
          paddingTop: '32px',
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            letterSpacing: '-0.01em',
          }}>
            Comments ({post.comment_count})
            {refreshingComments && (
              <span style={{
                fontSize: '14px',
                color: 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
              }}>
                <Icon name="RefreshCw" size={14} />
              </span>
            )}
          </h2>

          {/* Comment Filter */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              marginBottom: '6px',
            }}>
              Filter:{' '}
            </label>
            <select
              value={selectedItemId || ''}
              onChange={(e) => {
                setSelectedItemId(e.target.value || null);
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '11px 14px',
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '14px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
                transition: 'border-color var(--transition)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
            >
              <option value="">All Comments</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>On #{item.rank} - {item.title}</option>
              ))}
            </select>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleSubmitComment} style={{
            marginBottom: '28px',
            padding: '20px 24px',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
          }}>
            {commentError && (
              <div role="alert" style={{
                color: '#d32f2f',
                fontSize: '14px',
                marginBottom: '12px',
                padding: '8px 12px',
                background: '#ffebee',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #f44336',
              }}>
                {commentError}
              </div>
            )}
            <textarea
              ref={commentTextareaRef}
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              style={{
                width: '100%',
                minHeight: '90px',
                padding: '14px',
                background: 'var(--bg-tertiary)',
                border: '1.5px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '15px',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: '14px',
                resize: 'vertical',
                transition: 'border-color var(--transition)',
              }}
              maxLength={2000}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
              }}
            />
            <button
              type="submit"
              disabled={submitting || !commentContent.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 28px',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
                background: submitting ? 'var(--border-primary)' : 'var(--accent-gradient)',
                color: submitting ? 'var(--text-muted)' : '#fff',
                transition: 'all var(--transition)',
                opacity: submitting ? 0.7 : 1,
                boxShadow: submitting ? 'none' : '0 2px 8px rgba(255,59,48,0.3)',
              }}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>

          {comments.length === 0 ? (
            <p style={{
              color: 'var(--text-muted)',
              fontSize: '15px',
              textAlign: 'center',
              padding: '40px 0',
            }}>
              No comments yet. Be the first to comment!
            </p>
          ) : (
            rootComments.map(c => renderComment(c))
          )}
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-primary)',
        padding: '24px 20px',
        textAlign: 'center',
        background: 'var(--bg-secondary)',
      }}>
        <p style={{
          margin: 0,
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}>
          YoTop10 — Open Platform for Top 10 Lists
        </p>
      </footer>
    </div>
  );
}
