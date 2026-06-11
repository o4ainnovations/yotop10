'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { Icon } from '@/components/icons/Icon';
import { useAuthStore } from '@/stores/auth';
import { useRateLimitStore } from '@/stores/rateLimit';
import { SecureMyAuthority } from '@/components/SecureMyAuthority';

interface UserProfile {
  username: string;
  canonical_url?: string;
  profile_image_url?: string | null;
  trust_level: 'newbie' | 'ghost' | 'troll' | 'neutral' | 'scholar';
  created_at: string;
  stats: {
    member_since: string;
    total_posts: number;
    total_comments: number;
    approval_rate: number;
    total_views?: number;
  };
  posts: Array<{
    id: string; title: string; slug: string; status: string; post_type: string;
    view_count?: number; comment_count: number; created_at: string;
    category: { name?: string; slug: string } | null;
    revision_guidance?: string; rejection_reason?: string;
  }>;
  comments: Array<{ id: string; content: string; post_id: string; fire_count: number; reply_count: number; created_at: string }>;
  is_own_profile: boolean;
  trust_score?: number;
}

const POST_TYPE_LABELS: Record<string, string> = {
  top_list: 'Top List', this_vs_that: 'Debate', fact_drop: 'Fact Drop',
  best_of: 'Best Of', worst_of: 'Worst Of', counter_list: 'Counter',
};

const TIER_STYLES: Record<string, { ring: string; label: string; text: string; bg: string; dot: string }> = {
  scholar: { ring: 'ring-amber-500', label: 'Scholar', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' },
  neutral: { ring: 'ring-zinc-500', label: 'Neutral', text: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', dot: 'bg-zinc-500' },
  troll: { ring: 'ring-red-500', label: 'Troll', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
  newbie: { ring: 'ring-blue-500', label: 'Newbie', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
  ghost: { ring: 'ring-zinc-600', label: 'Ghost', text: 'text-zinc-500', bg: 'bg-zinc-700/30 border-zinc-700/30', dot: 'bg-zinc-600' },
};

export default function UserProfileClient({ initialProfile }: { initialProfile: UserProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments' | 'stats'>('posts');
  const [postFilter, setPostFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const fetchAuthUser = useAuthStore((s) => s.fetchUser);
  const rateLimitStatus = useRateLimitStore((s) => s.status);
  const rateLimitCountdown = useRateLimitStore((s) => s.countdown);
  const fetchRateStatus = useRateLimitStore((s) => s.fetchStatus);
  const tickCountdown = useRateLimitStore((s) => s.tickCountdown);
  const rateLimitErrorCount = useRateLimitStore((s) => s.errorCount);
  const retryTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Compute is_own_profile locally — server-side fetch can't determine identity
  const profileUsername = profile.username;
  const isOwn = (profile as any).is_own_profile ||
    (authUser?.username === profileUsername) ||
    (authUser?.custom_display_name === profileUsername);

  const trustScore = isOwn && authUser ? authUser.trust_score : profile.trust_score ?? 0;
  const tier = TIER_STYLES[profile.trust_level] || TIER_STYLES.neutral;

  useEffect(() => {
    if (isOwn && activeTab === 'stats' && rateLimitErrorCount > 0) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(fetchRateStatus, Math.min(1000 * Math.pow(2, rateLimitErrorCount), 10000));
    }
  }, [isOwn, activeTab, rateLimitErrorCount, fetchRateStatus]);
  useEffect(() => {
    if (isOwn && activeTab === 'stats') fetchRateStatus();
  }, [isOwn, activeTab, fetchRateStatus]);
  useEffect(() => {
    if (!rateLimitStatus || activeTab !== 'stats') return;
    const interval = setInterval(tickCountdown, 1000);
    return () => clearInterval(interval);
  }, [rateLimitStatus, activeTab, tickCountdown]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && activeTab === 'stats') fetchRateStatus(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(retryTimeoutRef.current); };
  }, [activeTab, fetchRateStatus]);

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingImage(true); setImageError(null);
    try {
      const uploadRes = await API.uploadProfileImage(file) as { success: boolean; url: string };
      await API.updateProfileImage(uploadRes.url); await fetchAuthUser();
      setProfile(p => p ? { ...p, profile_image_url: uploadRes.url } : p);
    } catch { setImageError('Upload failed.'); } finally { setUploadingImage(false); }
  };

  const initials = (profile.username[0] || '?').toUpperCase();

  // Compute filtered posts based on active filter pill
  const filteredPosts = profile.posts.filter(p => {
    if (postFilter === 'all') return true;
    if (postFilter === 'approved') return p.status === 'approved';
    if (postFilter === 'pending') return p.status !== 'approved' && !p.rejection_reason;
    if (postFilter === 'rejected') return p.status === 'rejected' || !!p.rejection_reason;
    return true;
  });

  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-[var(--color-bg)] text-white px-4 py-8 sm:px-6 sm:py-12">
      {/* ─── Profile Header ─── */}
      <div className="flex items-start gap-4 mb-8">
        {/* Avatar */}
        <div className={`shrink-0 rounded-full ring-2 ${tier.ring} p-0.5`}>
          {profile.profile_image_url ? (
            <Image src={profile.profile_image_url} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-red-600/20 text-xl font-bold text-zinc-400">
              {initials}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-lg font-bold leading-tight truncate">{profile.username}</h1>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-2xs font-semibold capitalize border ${tier.bg} ${tier.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${tier.dot}`} />
              {tier.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-3xs text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <Icon name="FileText" size={12} /> {profile.stats.total_posts} posts
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="MessageCircle" size={12} /> {profile.stats.total_comments}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Eye" size={12} /> {profile.stats.total_views ?? 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon name="BadgeCheck" size={12} /> {profile.stats.approval_rate}%
            </span>
            <span suppressHydrationWarning className="inline-flex items-center gap-1">
              <Icon name="Calendar" size={12} /> {formatDate(profile.stats.member_since)}
            </span>
          </div>

          {/* Own profile actions */}
          {isOwn && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-3xs text-zinc-600 hover:text-zinc-400 transition">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileUpload} disabled={uploadingImage} className="hidden" />
                {uploadingImage ? <><Icon name="RefreshCw" size={11} className="animate-spin" /> Uploading...</> : <><Icon name="Camera" size={11} /> Change photo</>}
              </label>
              <button onClick={() => router.push('/settings/account')} className="inline-flex items-center gap-1.5 text-3xs text-zinc-600 hover:text-orange-400 transition">
                <Icon name="Settings" size={11} /> Settings
              </button>
              {imageError && <span className="text-red-400 text-3xs">{imageError}</span>}
            </div>
          )}
        </div>
      </div>

      {/* ─── Trust gauge (own profile only) ─── */}
      {isOwn && (
        <div className="mb-6">
          <div className="flex h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
            <div className={`transition-all duration-500 ${tier.bg.split(' ')[0]}`} style={{ width: `${Math.min(100, (trustScore / 10) * 100)}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-3xs text-zinc-700">
            <span>Troll</span>
            <span>Neutral</span>
            <span>Scholar</span>
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="mb-6 flex border-b border-white/5">
        <button onClick={() => setActiveTab('posts')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'posts' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Posts ({profile.posts.length})
          {activeTab === 'posts' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
        </button>
        <button onClick={() => setActiveTab('comments')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors ${activeTab === 'comments' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
          Comments ({profile.comments.length})
          {activeTab === 'comments' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
        </button>
        {isOwn && (
          <button onClick={() => setActiveTab('stats')} className={`relative px-4 sm:px-5 py-3 text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${activeTab === 'stats' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            <Icon name="ChartBar" size={13} /> Stats
            {activeTab === 'stats' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
          </button>
        )}
      </div>

      {/* ─── Posts Tab ─── */}
      {activeTab === 'posts' && (
        <div>
          {/* Status filter pills (own profile only) */}
          {isOwn && profile.posts.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {(['all', 'approved', 'pending', 'rejected'] as const).map(status => {
                const count = status === 'all' ? profile.posts.length
                  : status === 'pending' ? profile.posts.filter(p => p.status !== 'approved' && !p.rejection_reason).length
                  : status === 'rejected' ? profile.posts.filter(p => p.status === 'rejected' || p.rejection_reason).length
                  : profile.posts.filter(p => p.status === 'approved').length;
                return (
                  <button key={status} onClick={() => setPostFilter(status)}
                    className={`rounded-full px-3 py-1 text-2xs font-medium transition ${
                      postFilter === status
                        ? status === 'approved' ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                          : status === 'pending' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : status === 'rejected' ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                        : 'bg-white/5 text-zinc-500 border border-white/10 hover:bg-white/10 hover:text-zinc-300'
                    }`}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filteredPosts.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <Icon name="FileText" size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500 mb-4">
                {postFilter === 'approved' ? 'No approved posts yet.' :
                 postFilter === 'pending' ? 'No pending posts.' :
                 postFilter === 'rejected' ? 'No rejected posts.' :
                 'No posts yet.'}
              </p>
              {isOwn && (
                <Link href="/new" className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:shadow-xl active:scale-[0.98]">
                  <Icon name="Plus" size={14} /> Create your first post
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredPosts.map(post => (
                <Link key={post.id} href={`/${post.slug}`} className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-orange-500/20">
                  <div className="flex items-start gap-2 mb-2">
                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-bold font-mono ${
                      post.post_type === 'best_of' ? 'bg-emerald-500/10 text-emerald-400' :
                      post.post_type === 'worst_of' ? 'bg-red-500/10 text-red-400' :
                      post.post_type === 'this_vs_that' ? 'bg-purple-500/10 text-purple-400' :
                      post.post_type === 'fact_drop' ? 'bg-pink-500/10 text-pink-400' :
                      'bg-orange-500/10 text-orange-400'
                    }`}>{POST_TYPE_LABELS[post.post_type] || post.post_type.replace(/_/g, ' ')}</span>
                    {isOwn && post.status !== 'approved' && (
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-2xs font-semibold ${
                        post.revision_guidance ? 'bg-orange-500/10 text-orange-400' :
                        post.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                        'bg-amber-500/10 text-amber-400'
                      }`}>{post.revision_guidance ? 'Revision' : post.status.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-zinc-200 leading-snug group-hover:text-white transition mb-2 line-clamp-2">{post.title}</h3>
                  <div className="flex items-center gap-3 text-3xs text-zinc-600">
                    <span className="inline-flex items-center gap-1"><Icon name="MessageCircle" size={11} /> {post.comment_count}</span>
                    <span className="inline-flex items-center gap-1"><Icon name="Eye" size={11} /> {post.view_count ?? 0}</span>
                    <span suppressHydrationWarning>{formatDate(post.created_at)}</span>
                  </div>
                  {isOwn && post.rejection_reason && (
                    <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 p-2 text-2xs text-red-400"><strong>Reason:</strong> {post.rejection_reason}</div>
                  )}
                  {isOwn && post.revision_guidance && (
                    <div className="mt-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-2 text-2xs text-orange-400"><strong>Feedback:</strong> {post.revision_guidance}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Comments Tab ─── */}
      {activeTab === 'comments' && (
        <div className="space-y-3">
          {profile.comments.length === 0 ? (
            <div className="py-16 text-center">
              <Icon name="MessageCircle" size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No comments yet.</p>
            </div>
          ) : (
            profile.comments.map(c => (
              <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <p className="mb-2 text-sm leading-relaxed text-zinc-300 line-clamp-3">{c.content}</p>
                <div className="flex items-center gap-3 text-3xs text-zinc-600">
                  <span className="inline-flex items-center gap-1"><Icon name="Flame" size={11} color="#ea580c" /> {c.fire_count}</span>
                  <span className="inline-flex items-center gap-1"><Icon name="MessageCircle" size={11} /> {c.reply_count}</span>
                  <span suppressHydrationWarning>{formatDate(c.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── Stats Tab (own only) ─── */}
      {activeTab === 'stats' && isOwn && rateLimitStatus && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Engagement</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/5 p-3 text-center"><p className="text-lg font-bold font-mono text-white">{profile.stats.total_views ?? 0}</p><p className="text-2xs text-zinc-500">Views</p></div>
              <div className="rounded-lg bg-white/5 p-3 text-center"><p className="text-lg font-bold font-mono text-white">{profile.stats.total_posts}</p><p className="text-2xs text-zinc-500">Posts</p></div>
              <div className="rounded-lg bg-white/5 p-3 text-center"><p className="text-lg font-bold font-mono text-white">{profile.stats.total_comments}</p><p className="text-2xs text-zinc-500">Comments</p></div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Approval Rate</h3>
            <div className="flex h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="bg-green-500 transition-all" style={{ width: `${profile.stats.approval_rate}%` }} />
              <div className="bg-red-500/50 transition-all" style={{ width: `${100 - profile.stats.approval_rate}%` }} />
            </div>
            <div className="flex justify-between mt-1 text-2xs text-zinc-600">
              <span>{profile.stats.approval_rate}% approved</span>
              <span>{100 - profile.stats.approval_rate}% rejected</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Current Limits</h3>
            <div className="space-y-3">
              {(['posts', 'comments', 'counter_lists'] as const).map(key => {
                const limit = rateLimitStatus.limits[key];
                if (!limit || typeof limit.remaining === 'undefined') return null;
                const pct = limit.total !== 'Unlimited' ? Math.round((limit.remaining as number) / (limit.total as number) * 100) : 100;
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-zinc-400">{key.replace('_', ' ')}</span>
                      <span className="font-mono text-zinc-500">{limit.remaining} / {limit.total}</span>
                    </div>
                    {typeof limit.total === 'number' && (
                      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div className="bg-orange-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-2xs text-zinc-600">
              <Icon name="RefreshCw" size={11} /> Resets in: {rateLimitCountdown !== null ? `${Math.floor(rateLimitCountdown / 60)}m ${rateLimitCountdown % 60}s` : '...'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Secure My Authority ─── */}
      {isOwn && <div className="mt-8"><SecureMyAuthority /></div>}
    </div>
  );
}
