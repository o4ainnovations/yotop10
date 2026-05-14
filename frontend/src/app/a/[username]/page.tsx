'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';
import { useAuthStore } from '@/stores/auth';
import { useRateLimitStore } from '@/stores/rateLimit';
import { SecureMyAuthority } from '@/components/SecureMyAuthority';
import NotFound from '@/components/NotFound';

interface UserProfile {
  username: string;
  canonical_url?: string;
  trust_level: 'troll' | 'neutral' | 'scholar';
  created_at: string;
  stats: {
    member_since: string;
    total_posts: number;
    total_comments: number;
    approval_rate: number;
  };
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    post_type: string;
    comment_count: number;
    created_at: string;
    category: { name?: string; slug: string } | null;
    revision_guidance?: string;
    rejection_reason?: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    post_id: string;
    fire_count: number;
    reply_count: number;
    created_at: string;
  }>;
  is_own_profile: boolean;
  trust_score?: number;
}

const trustLevelStyles: Record<string, string> = {
  scholar: 'bg-green-500/10 text-green-400 border-green-500/30',
  troll: 'bg-red-500/10 text-red-400 border-red-500/30',
  neutral: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

const postStatusStyles: Record<string, string> = {
  approved: 'text-green-400',
  rejected: 'text-red-400',
};

export default function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'stats'>('posts');
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const fetchAuthUser = useAuthStore((s) => s.fetchUser);

  const rateLimitStatus = useRateLimitStore((s) => s.status);
  const rateLimitCountdown = useRateLimitStore((s) => s.countdown);
  const fetchRateStatus = useRateLimitStore((s) => s.fetchStatus);
  const tickCountdown = useRateLimitStore((s) => s.tickCountdown);
  const rateLimitErrorCount = useRateLimitStore((s) => s.errorCount);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      const { username } = await params;

      try {
        const data = await API.getUserProfile(username) as UserProfile;

        if (cancelled) return;

        if (data.canonical_url && data.canonical_url !== `/a/${username}`) {
          router.replace(data.canonical_url, { scroll: false });
        }

        setProfile(data);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [params, router]);

  useEffect(() => {
    if (profile?.is_own_profile && activeTab === 'stats' && rateLimitErrorCount > 0) {
      clearTimeout(retryTimeoutRef.current);
      const backoffMs = Math.min(1000 * Math.pow(2, rateLimitErrorCount), 10000);
      retryTimeoutRef.current = setTimeout(fetchRateStatus, backoffMs);
    }
  }, [profile?.is_own_profile, activeTab, rateLimitErrorCount, fetchRateStatus]);

  useEffect(() => {
    if (profile?.is_own_profile && activeTab === 'stats') {
      fetchRateStatus();
    }
  }, [profile?.is_own_profile, activeTab, fetchRateStatus]);

  useEffect(() => {
    if (!rateLimitStatus || activeTab !== 'stats') return;

    const interval = setInterval(tickCountdown, 1000);
    return () => clearInterval(interval);
  }, [rateLimitStatus, activeTab, tickCountdown]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && activeTab === 'stats') {
        fetchRateStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(retryTimeoutRef.current);
    };
  }, [activeTab, fetchRateStatus]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) return;

    try {
      await API.updateDisplayName(newDisplayName);
      await fetchAuthUser();
      setEditingName(false);
      setNewDisplayName('');
      setNameError(null);
    } catch {
      setNameError('Failed to update display name. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!profile) return <NotFound message="User does not exist." />;

  const tabButtonClasses = (tab: 'posts' | 'comments' | 'stats') =>
    `px-4 sm:px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
      activeTab === tab
        ? 'border-orange-400 text-white'
        : 'border-transparent text-zinc-500 hover:text-zinc-300'
    }`;

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-zinc-950 px-3 py-6 text-white sm:px-6 sm:py-10 sm:pb-16">
      {/* Profile Header Card */}
      <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5 sm:p-8">
        <h1 className="mb-2 text-2xl font-bold -tracking-[0.02em] text-white sm:text-3xl">
          {profile.username}
        </h1>

        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`inline-block rounded-lg border px-2.5 py-0.5 text-xs font-semibold capitalize ${trustLevelStyles[profile.trust_level] || trustLevelStyles.neutral}`}>
            {profile.trust_level}
          </span>
          {profile.is_own_profile && authUser && (
            <span className="text-sm text-zinc-400">
              Trust Score: {authUser.trust_score.toFixed(2)} / 2.0
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="MessageCircle" size={14} className="text-zinc-500" /> {profile.stats.total_posts} posts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="MessageCircle" size={14} className="text-zinc-500" /> {profile.stats.total_comments} comments
          </span>
          <span>{profile.stats.approval_rate}% approval</span>
          <span>Member since {new Date(profile.stats.member_since).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Own Profile Actions */}
      {profile.is_own_profile && (
        <div className="mb-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5 sm:p-8">
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => setEditingName(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition hover:border-orange-500/30 hover:text-orange-400"
            >
              Edit Display Name
            </button>
            <button
              onClick={() => router.push('/username-history')}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-white transition hover:border-orange-500/30 hover:text-orange-400"
            >
              Username History
            </button>
          </div>

          {editingName && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              {nameError && (
                <div role="alert" className="mb-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {nameError}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="a_newname"
                  maxLength={32}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                />
                <button
                  onClick={handleUpdateDisplayName}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="rounded-xl border border-white/10 bg-transparent px-5 py-2.5 text-sm font-medium text-zinc-400 transition hover:border-orange-500/30 hover:text-orange-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex border-b border-white/5">
        <button onClick={() => setActiveTab('posts')} className={tabButtonClasses('posts')}>
          Posts ({profile.posts.length})
        </button>
        <button onClick={() => setActiveTab('comments')} className={tabButtonClasses('comments')}>
          Comments ({profile.comments.length})
        </button>
        {profile.is_own_profile && (
          <button
            onClick={() => setActiveTab('stats')}
            className={`inline-flex items-center gap-1.5 px-4 sm:px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'stats'
                ? 'border-orange-400 text-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon name="Star" size={14} color="#f97316" /> Stats
          </button>
        )}
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div className="flex flex-col gap-4">
          {profile.posts.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No posts yet.
            </p>
          ) : (
            profile.posts.map((post) => (
              <div
                key={post.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-300 hover:border-orange-500/30 hover:bg-white/[0.04] sm:p-6"
              >
                <h3 className="mb-2.5 text-base font-semibold leading-snug sm:text-lg">
                  <Link
                    href={`/${post.slug}`}
                    className="text-white transition-colors hover:text-orange-400"
                  >
                    {post.title}
                  </Link>
                </h3>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-zinc-500">
                  <span>{post.category?.name || 'Uncategorized'}</span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="MessageCircle" size={12} className="text-zinc-500" /> {post.comment_count}
                  </span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  {profile.is_own_profile && (
                    <span className={`text-xs font-semibold ${
                      post.revision_guidance
                        ? 'text-orange-400'
                        : postStatusStyles[post.status]
                        || 'text-amber-400'
                    }`}>
                      {post.revision_guidance ? 'Revision Requested' : post.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {profile.is_own_profile && post.rejection_reason && (
                  <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                    <strong>Reason:</strong> {post.rejection_reason}
                  </div>
                )}
                {profile.is_own_profile && post.revision_guidance && (
                  <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-sm text-orange-400">
                    <strong>Admin feedback:</strong> {post.revision_guidance}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Comments Tab */}
      {activeTab === 'comments' && (
        <div className="flex flex-col gap-4">
          {profile.comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No comments yet.
            </p>
          ) : (
            profile.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-5 sm:p-6">
                <p className="mb-2.5 text-sm leading-relaxed text-white sm:text-base">
                  {comment.content}
                </p>
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="Flame" size={12} color="#ea580c" /> {comment.fire_count}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="MessageCircle" size={12} className="text-zinc-500" /> {comment.reply_count}
                  </span>
                  <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && profile.is_own_profile && rateLimitStatus && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 sm:p-8">
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-4">
              <span className="text-sm text-zinc-400 sm:text-base">Trust Score:</span>
              <span className="text-xl font-bold text-white">
                {rateLimitStatus.trust_score.toFixed(2)} / 2.0
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] p-4">
              <span className="text-sm text-zinc-400 sm:text-base">Tier:</span>
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-0.5 text-sm font-semibold capitalize text-white">
                {rateLimitStatus.current_tier}
              </span>
            </div>

            <h3 className="mt-4 flex items-center gap-2 text-sm font-semibold text-white sm:text-base">
              <Icon name="ChartBar" size={16} className="text-zinc-500" />
              Current Limits
            </h3>

            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Icon name="Check" size={14} color="#4ade80" />
                Posts: {rateLimitStatus.limits.posts.remaining} / {rateLimitStatus.limits.posts.total} remaining
              </p>
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Icon name="Check" size={14} color="#4ade80" />
                Comments: {rateLimitStatus.limits.comments.remaining} / {rateLimitStatus.limits.comments.total} remaining
              </p>
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                <Icon name="Check" size={14} color="#4ade80" />
                Counter Lists: {rateLimitStatus.limits.counter_lists.remaining}
              </p>
            </div>

            <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
              <Icon name="RefreshCw" size={14} className="text-zinc-500" />
              Resets in: {rateLimitCountdown !== null
                ? `${Math.floor(rateLimitCountdown / 60)} minutes ${rateLimitCountdown % 60} seconds`
                : 'Calculating...'}
            </p>

            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Icon name="Lightbulb" size={14} color="#f97316" />
              Next tier at 1.0 trust: 4 posts/hour
            </p>
          </div>
        </div>
      )}

      {/* Secure My Authority */}
      {profile.is_own_profile && (
        <div className="mt-8">
          <SecureMyAuthority />
        </div>
      )}
    </div>
  );
}
