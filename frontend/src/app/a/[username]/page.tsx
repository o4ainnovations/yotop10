'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useRateLimitStore } from '@/stores/rateLimit';
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
    category: { name: string; slug: string } | null;
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

  if (loading) return <div>Loading...</div>;
  if (!profile) return <NotFound message="User does not exist." />;

  return (
    <div>
      <h1>{profile.username}</h1>

      <p>
        Status: {profile.trust_level}
        {profile.is_own_profile && authUser && (
          <> | Trust Score: {authUser.trust_score.toFixed(2)} / 2.0</>
        )}
      </p>

      <p>
        Posts: {profile.stats.total_posts} |
        Comments: {profile.stats.total_comments} |
        Approval Rate: {profile.stats.approval_rate}% |
        Member since: {new Date(profile.stats.member_since).toLocaleDateString()}
      </p>

      {profile.is_own_profile && (
        <div style={{ marginBottom: '20px' }}>
          <button onClick={() => setEditingName(true)}>Edit Display Name</button>
          <button onClick={() => router.push('/username-history')} style={{ marginLeft: '10px' }}>Username History</button>
          {editingName && (
            <div style={{ marginTop: '10px' }}>
              {nameError && (
                <div role="alert" style={{ color: '#d32f2f', fontSize: '14px', marginBottom: '8px' }}>{nameError}</div>
              )}
              <input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="a_newname"
                maxLength={32}
              />
              <button onClick={handleUpdateDisplayName}>Save</button>
              <button onClick={() => setEditingName(false)}>Cancel</button>
            </div>
          )}
        </div>
      )}

      <hr />

      <div>
        <button
          onClick={() => setActiveTab('posts')}
          style={{ fontWeight: activeTab === 'posts' ? 'bold' : 'normal' }}
        >
          Posts ({profile.posts.length})
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          style={{ fontWeight: activeTab === 'comments' ? 'bold' : 'normal' }}
        >
          Comments ({profile.comments.length})
        </button>
        {profile.is_own_profile && (
          <button
            onClick={() => setActiveTab('stats')}
            style={{ fontWeight: activeTab === 'stats' ? 'bold' : 'normal', marginLeft: '10px' }}
          >
            ⭐ Stats
          </button>
        )}
      </div>

      <hr />

      {activeTab === 'posts' && (
        <div>
          {profile.posts.length === 0 ? (
            <p>No posts yet.</p>
          ) : (
            profile.posts.map((post) => (
              <div key={post.id}>
                <h3><Link href={`/${post.slug}`}>{post.title}</Link></h3>
                <p>
                  {post.category?.name || 'Uncategorized'} |
                  💬 {post.comment_count} |
                  {new Date(post.created_at).toLocaleDateString()}
                  {profile.is_own_profile && <> | Status: {post.status.replace('_', ' ')}</>}
                </p>
                <hr />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'comments' && (
        <div>
          {profile.comments.length === 0 ? (
            <p>No comments yet.</p>
          ) : (
            profile.comments.map((comment) => (
              <div key={comment.id}>
                <p>{comment.content}</p>
                <p>
                  🔥 {comment.fire_count} |
                  💬 {comment.reply_count} |
                  {new Date(comment.created_at).toLocaleDateString()}
                </p>
                <hr />
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'stats' && profile.is_own_profile && rateLimitStatus && (
        <div>
          <p>
            Trust Score: {rateLimitStatus.trust_score.toFixed(2)} / 2.0
          </p>
          <p>Tier: {rateLimitStatus.current_tier}</p>

          <h3>📊 Current Limits:</h3>
          <p>✅ Posts: {rateLimitStatus.limits.posts.remaining} / {rateLimitStatus.limits.posts.total} remaining</p>
          <p>✅ Comments: {rateLimitStatus.limits.comments.remaining} / {rateLimitStatus.limits.comments.total} remaining</p>
          <p>✅ Counter Lists: {rateLimitStatus.limits.counter_lists.remaining}</p>

          <p>🔄 Resets in: {rateLimitCountdown !== null ? `${Math.floor(rateLimitCountdown / 60)} minutes ${rateLimitCountdown % 60} seconds` : 'Calculating...'}</p>

          {rateLimitStatus.trust_score < 1.0 && (
            <p>💡 Next tier at 1.0 trust: 4 posts/hour</p>
          )}
        </div>
      )}
    </div>
  );
}
