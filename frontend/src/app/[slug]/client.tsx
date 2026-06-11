'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import NotFound from '@/components/NotFound';
import Link from 'next/link';
import Image from 'next/image';
import { API } from '@/lib/api';
import { formatDate, relativeTime } from '@/lib/dates';
import { Icon } from '@/components/icons/Icon';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { BookmarkButton } from '@/components/BookmarkButton';
import { ShareButton } from '@/components/ShareButton';
import { ThisVsThatView } from '@/components/ThisVsThatView';
import { BattleView } from '@/components/BattleView';
import { CounterListSection } from '@/components/CounterListSection';
import { RESERVED_ROUTES } from '@/lib/reservedRoutes';

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
  category_name?: string;
  format?: 'list_only' | 'hero_list' | 'full_list';
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

export default function PostDetailClient({
  slug,
  initialPost,
  initialItems,
  initialComments,
}: {
  slug: string;
  initialPost: Post;
  initialItems: ListItem[];
  initialComments: Comment[];
}) {
  const searchParams = useSearchParams();
  const itemParam = searchParams?.get('item');
  const vsParam = searchParams?.get('vs');
  const [vsSlug, setVsSlug] = useState<string | null>(vsParam || null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [post, setPost] = useState<Post>(initialPost);
  const [items] = useState<ListItem[]>(initialItems);
  const [comments, setComments] = useState<Comment[]>(initialComments);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    setRefreshingComments(true);

    try {
      const [postData, commentsData] = await Promise.all([
        API.getPost(slug),
        API.getComments(slug),
      ]);

      if (!mountedRef.current) return;

      setPost(postData.post);
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
      setCommentError('Failed to refresh comments. Please try again.');
    } finally {
      if (mountedRef.current) {
        setRefreshingComments(false);
      }
    }
  }, [slug]);

  useEffect(() => {
    mountedRef.current = true;
    const abortController = new AbortController();

    // Only fetch reaction state on mount; post/comments already rendered server-side
    const allTargets = initialComments.map((c) => ({ type: 'comment' as const, id: c.id }));
    if (allTargets.length > 0) {
      API.getReactionState(allTargets, { signal: abortController.signal }).then((reactionState) => {
        if (!mountedRef.current) return;
        const data = reactionState as { targets: Array<{ type: string; id: string; user_reacted: boolean }> };
        const reactedIds = new Set<string>(data.targets.filter(t => t.user_reacted).map(t => String(t.id)));
        setUserReactions(reactedIds);
      }).catch(() => {});
    }

    return () => { abortController.abort(); mountedRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (RESERVED_ROUTES.has(slug)) {
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
      setPost(prev => ({ ...prev, comment_count: prev.comment_count + 1 }));
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
      setPost(prev => ({ ...prev, comment_count: prev.comment_count + 1 }));
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
    const cappedDepth = Math.min(depth, 3);
    const indentClass = cappedDepth === 0 ? '' : cappedDepth === 1 ? 'ml-4' : cappedDepth === 2 ? 'ml-8' : 'ml-12';

    const reacted = userReactions.has(comment.id);

    return (
      <div key={comment.id} className={`mt-3 border-l-2 border-white/10 pl-3 ${indentClass}`}>
        <div className="rounded-lg border border-white/5 bg-white/5 p-3.5 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="flex items-center justify-center rounded-full bg-white/10 text-xs font-mono text-zinc-400 w-7 h-7 shrink-0">
              {(comment.author_username || '?')[0].toUpperCase()}
            </span>
            <strong className="text-sm2 font-mono text-white sm:text-sm">
              {comment.author_display_name}
            </strong>
            <span className="inline-flex items-center gap-1 text-3xs text-zinc-500">
              <Icon name="Sparkles" size={12} color="#f97316" /> {comment.spark_score.toFixed(2)}
            </span>
            {comment.list_item_id && itemRank && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-orange-500/10 px-2 py-0.5 text-3xs font-medium text-orange-400">
                <Icon name="Pin" size={11} /> On item #{itemRank}
              </span>
            )}
            {comment.parent_comment_id && (
              <span className="inline-flex items-center gap-1 text-3xs text-zinc-500">
                <Icon name="Reply" size={11} /> Reply
              </span>
            )}
            <span className="text-3xs text-zinc-500" suppressHydrationWarning>
              {formatDate(comment.created_at)}
            </span>
          </div>
          <p className="mb-2.5 text-sm leading-relaxed text-white sm:text-base">
            {comment.content}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleReaction('comment', comment.id)}
              disabled={reacting}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                reacted
                  ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
                  : 'border border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon name="Flame" size={14} color="#ea580c" /> {comment.fire_count}
            </button>
            {depth < 10 && (
              <button
                onClick={() => setReplyTo(isReplying ? null : comment.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-orange-400 transition hover:bg-orange-500/10"
              >
                {isReplying ? 'Cancel' : 'Reply'}
              </button>
            )}
          </div>

          {isReplying && (
            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3.5">
              <textarea
                value={replyForm.content}
                onChange={(e) => handleReplyContentChange(comment.id, e.target.value)}
                placeholder={`Reply to ${comment.author_display_name}...`}
                className="mb-2.5 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                maxLength={2000}
              />
              <button
                onClick={() => handleSubmitReply(comment.id)}
                disabled={replyForm.submitting || !replyForm.content.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 disabled:cursor-not-allowed disabled:opacity-60"
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

  if (!post) return <NotFound message="Page does not exist." />;

  const rootComments = comments.filter(c => c.depth === 0);

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-[var(--color-bg)] px-4 py-6 sm:px-6 sm:py-10 sm:pb-16">
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: post.category_name || post.category_slug, href: `/c/${post.category_slug}` },
          { label: post.title, href: `/${post.slug}` },
        ]} />
        {vsSlug && ['top_list', 'best_of', 'worst_of'].includes(post.post_type) ? (
          <BattleView originalSlug={slug} counterSlug={vsSlug} onClose={() => setVsSlug(null)} />
        ) : post.post_type === 'this_vs_that' ? (
          <ThisVsThatView slug={slug} post={post} items={items} />
        ) : post.post_type === 'fact_drop' ? (
          <>
          {/* Fact Drop — simple, focused on the fact */}
          <div className="max-w-2xl mx-auto py-10">
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500/20 to-pink-500/20 border border-orange-500/30 px-4 py-1.5 text-xs font-bold text-orange-400 uppercase tracking-wider">
                <Icon name="Lightbulb" size={14} /> Did You Know?
              </span>
            </div>
            <p className="text-lg sm:text-xl leading-relaxed text-white text-center mb-6 font-medium">
              {post.intro}
            </p>
            {items.map(item => (
              <div key={item.id} className="text-center">
                <p className="text-base sm:text-lg leading-relaxed text-zinc-300 mb-6">
                  {item.justification || item.title}
                </p>
                <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1.5"><Icon name="User" size={12} /> {post.author_display_name}</span>
                  <span suppressHydrationWarning>{relativeTime(post.created_at)}</span>
                </div>
              </div>
            ))}
            {items[0]?.source_url && (
              <div className="text-center mt-8">
                <a href={items[0].source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition">
                  <Icon name="ExternalLink" size={14} /> View Source
                </a>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 mt-8">
              <BookmarkButton postId={post.id} />
              <ShareButton slug={slug} title={post.title} postId={post.id} />
            </div>
          </div>
          </>
        ) : (
        <>
        {/* Counter List Battle Banner */}
        {post.post_type === 'counter_list' && (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 mb-6 flex items-center gap-3">
            <Icon name="Swords" size={20} className="text-orange-400 shrink-0" />
            <p className="text-sm text-zinc-300">
              <strong className="text-orange-400">Counter list</strong> — a rebuttal to another list.
              {post.intro?.startsWith('Counter to:') && (
                <> View the original: <Link href={`/${post.intro.replace(/^Counter to:\s*/, '').trim()}`} className="text-orange-400 underline hover:text-orange-300">{post.intro.replace(/^Counter to:\s*/, '').trim()}</Link></>
              )}
            </p>
          </div>
        )}
        {/* Post Header — minimal, clean */}
        <header className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mb-3">
            <span className={`rounded-md border px-2 py-0.5 text-2xs font-medium capitalize ${
              post.post_type === 'best_of' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
              post.post_type === 'worst_of' ? 'border-red-500/30 bg-red-500/10 text-red-400' :
              'border-white/10 bg-white/5 text-zinc-500'
            }`}>
              {post.post_type === 'top_list' ? 'Top List' :
               post.post_type === 'best_of' ? 'Best Of' :
               post.post_type === 'worst_of' ? 'Worst Of' :
               post.post_type.replace(/_/g, ' ')}
            </span>
            <Link href={`/c/${post.category_slug}`} className="hover:text-orange-400 transition">
              {post.category_name || post.category_slug}
            </Link>
            <span suppressHydrationWarning>{formatDate(post.created_at)}</span>
          </div>

          <h1 className="text-2xl font-bold leading-tight text-white mb-3 sm:text-3xl sm:leading-tight">
            {post.title}
          </h1>

          <p className="text-sm leading-relaxed text-zinc-400 sm:text-base sm:leading-relaxed">
            {post.post_type === 'counter_list' && post.intro?.startsWith('Counter to:') ? post.intro.replace(/^Counter to:\s*[^\s]+\s*/, '') || post.intro : post.intro}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">
                By{' '}
                <Link
                  href={`/a/${post.author_username.replace(/^a_/, '')}`}
                  className="font-semibold text-orange-400 hover:text-orange-300 transition"
                >
                  {post.author_display_name}
                </Link>
              </span>
              <span className="text-xs text-zinc-600">{post.view_count} views</span>
            </div>
            <div className="flex items-center gap-3">
              <BookmarkButton postId={post.id} />
              <ShareButton slug={slug} title={post.title} postId={post.id} />
              <Link
                href={`/${slug}/history`}
                className="text-xs text-zinc-500 hover:text-orange-400 transition"
              >
                History
              </Link>
            </div>
          </div>
        </header>

        {/* Ranked List */}
        <section className="mb-12">
          {post.hero_image_url && (post.format === 'hero_list' || post.format === 'full_list') && (
            <div className="mb-8 overflow-hidden rounded-xl border border-white/5">
              <Image
                src={post.hero_image_url}
                alt={post.title}
                width={1200}
                height={675}
                className="block w-full h-auto"
                unoptimized
              />
            </div>
          )}

          <div className="space-y-3 sm:space-y-4">
            {items.map(item => {
              const hasImage = !!(item.image_url && (post.format === 'hero_list' || post.format === 'full_list'));
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 sm:gap-5 rounded-xl border border-white/5 bg-white/5 p-4 sm:p-6 transition ${
                    post.post_type === 'best_of' ? 'hover:border-emerald-500/20' :
                    post.post_type === 'worst_of' ? 'hover:border-red-500/20' :
                    'hover:border-orange-500/20'
                  }`}
                >
                  {/* Rank badge */}
                  <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${
                    post.post_type === 'best_of' ? 'bg-emerald-500/20 border border-emerald-500/20' :
                    post.post_type === 'worst_of' ? 'bg-red-500/20 border border-red-500/20' :
                    'bg-gradient-to-br from-orange-500/20 to-red-600/20 border border-orange-500/20'
                  }`}>
                    <span className={`text-sm sm:text-base font-bold ${
                      post.post_type === 'best_of' ? 'text-emerald-400' :
                      post.post_type === 'worst_of' ? 'text-red-400' :
                      'text-orange-400'
                    }`}>
                      {post.post_type === 'best_of' ? `B${item.rank}` :
                       post.post_type === 'worst_of' ? `W${item.rank}` :
                       item.rank}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-bold text-white mb-2 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base leading-relaxed text-zinc-400 mb-3">
                      {item.justification}
                    </p>
                    {hasImage && (
                      <div className="mb-3 overflow-hidden rounded-lg border border-white/5 max-w-md">
                        <Image
                          src={item.image_url!}
                          alt={item.title}
                          width={400}
                          height={280}
                          className="block w-full h-auto"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition"
                        >
                          <Icon name="ExternalLink" size={11} />
                          Source
                        </a>
                      )}
                      <button
                        onClick={() => toggleItemDropdown(item.id)}
                        className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-orange-400 transition"
                      >
                        <Icon name="ChevronDown" size={12} />
                        Comment on this item
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Counter-List Arena */}
        {['top_list', 'best_of', 'worst_of'].includes(post.post_type) && (
          <section className="border-t border-white/5 pt-8 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Challenge This List</h2>
            </div>
            <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
              Disagree with this ranking? Submit your own version and let the community decide.
            </p>
            <Link
              href={`/submit?type=counter_list&parent=${slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl active:scale-[0.98]"
            >
              Submit a Counter-List
            </Link>
          </section>
        )}

        {/* Existing counters */}
        {['top_list', 'best_of', 'worst_of'].includes(post.post_type) && (
          <CounterListSection slug={slug} />
        )}

        {/* Related posts from same category */}
        <section className="border-t border-white/5 pt-8 mb-8">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">More from {post.category_name || post.category_slug}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.length > 0 && (
              <Link href={`/c/${post.category_slug}`} className="col-span-full rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-zinc-500 hover:text-orange-400 hover:border-orange-500/20 transition text-center">
                Browse all posts in {post.category_name || post.category_slug} &rarr;
              </Link>
            )}
          </div>
        </section>

        {/* Comments Section */}
        <section ref={commentsSectionRef} className="border-t border-white/5 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Comments ({post.comment_count})
            </h2>
            <select
              value={selectedItemId || ''}
              onChange={(e) => setSelectedItemId(e.target.value || null)}
              className="max-w-[220px] appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-400 focus:border-orange-500/50 focus:outline-none"
            >
              <option value="">All comments</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>#{item.rank} - {item.title.substring(0, 30)}</option>
              ))}
            </select>
          </div>

          {/* Comment Form */}
          <form onSubmit={handleSubmitComment} className="mb-7 rounded-xl border border-white/5 bg-white/5 p-4 sm:p-6">
            {commentError && (
              <div role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {commentError}
              </div>
            )}
            <textarea
              ref={commentTextareaRef}
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              className="mb-3.5 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none sm:text-base"
              maxLength={2000}
            />
            <button
              type="submit"
              disabled={submitting || !commentContent.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>

          {comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            rootComments.map(c => renderComment(c))
          )}
        </section>
        </>
      )}

      {/* Footer handled by AppFooter in layout */}
    </main>
  );
}
