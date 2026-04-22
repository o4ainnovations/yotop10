'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API, apiFetch } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';
import NotFound from '@/components/NotFound';

interface RateLimitStatus {
  trust_score: number;
  current_tier: 'troll' | 'neutral' | 'scholar';
  limits: {
    posts: {
      total: number;
      remaining: number;
      reset_in_seconds: number;
    };
    comments: {
      total: number;
      remaining: number;
      reset_in_seconds: number;
    };
    counter_lists: {
      total: string;
      remaining: string;
      reset_in_seconds: null;
    };
  };
}

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

  useEffect(() => {
    // Initialize fingerprint for auth check
    getFingerprint();

    const fetchProfile = async () => {
      const { username } = await params;
      console.log(`[PROFILE] Fetching user profile for: ${username}`);
      
      try {
        const data = await API.getUserProfile(username) as UserProfile;
        console.log(`[PROFILE] Received data:`, data);
        
        // Handle canonical URL replacement - NO REDIRECTS, NO PAGE RELOAD
        if (data.canonical_url && data.canonical_url !== `/a/${username}`) {
          console.log(`[PROFILE] Replacing URL with canonical: ${data.canonical_url}`);
          router.replace(data.canonical_url, { scroll: false });
        }
        
        setProfile(data);
    } catch (error: any) {
      console.error(`[PROFILE] Fetch failed:`, error);
      setProfile(null);
    } finally {
        setLoading(false);
      }
    };

  fetchProfile();
}, [params, router]);

// Single source of truth - no duplicate state
const [rateLimitData, setRateLimitData] = useState<{
  status: RateLimitStatus | null;
  fetchedAt: number;
  errorCount: number;
}>({
  status: null,
  fetchedAt: 0,
  errorCount: 0
});

const [countdown, setCountdown] = useState<number | null>(null);

// Fetch rate limits with exponential backoff
const fetchRateLimits = useCallback(async () => {
  if (!profile?.is_own_profile) return;
  
  try {
    const data = await apiFetch<RateLimitStatus>('/users/me/rate-limits');
    
    setRateLimitData({
      status: data,
      fetchedAt: Date.now(),
      errorCount: 0
    });
    
    setCountdown(data.limits.posts.reset_in_seconds);
    
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-unused-vars
    const newErrorCount = rateLimitData.errorCount + 1;
    const backoffMs = Math.min(1000 * Math.pow(2, newErrorCount), 10000);
    
    console.debug('[RateLimit] Grace period retry backoff', {
      attempt: newErrorCount,
      backoff: backoffMs
    });
    
    setRateLimitData(prev => ({ ...prev, errorCount: newErrorCount }));
    
    // Automatic retry with backoff
    setTimeout(fetchRateLimits, backoffMs);
  }
}, [profile?.is_own_profile, rateLimitData.errorCount]);

// Fetch rate limit status only for own profile
useEffect(() => {
  if (!profile?.is_own_profile || activeTab !== 'stats') return;

  fetchRateLimits();
  
  // NOTE: 60s interval COMPLETELY REMOVED per plans.md specification
  // No double timers. No race conditions.
  
}, [profile?.is_own_profile, activeTab, fetchRateLimits]);

// Safe countdown timer implementation with strict boundary checking
useEffect(() => {
  if (!rateLimitData.status || activeTab !== 'stats') return;
  
  const interval = setInterval(() => {
    setCountdown(prev => {
      // Strict boundary checking - never go below zero
      if (prev === null || prev <= 0) {
        clearInterval(interval);
        // Auto-refresh exactly when timer hits zero
        fetchRateLimits();
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  // Explicit cleanup on ALL state changes
  return () => {
    clearInterval(interval);
  };
  
  // Re-run effect if user navigates away/back, switches tabs, or new data arrives
}, [rateLimitData.status, activeTab, fetchRateLimits]);

// Tab visibility detection for background tab drift correction
useEffect(() => {
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && activeTab === 'stats') {
      // Full refresh when tab comes back to foreground
      fetchRateLimits();
    }
  };
  
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
}, [activeTab, fetchRateLimits]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    
    try {
      await API.updateDisplayName(newDisplayName);
      // Refresh user data on homepage by reloading after name change
      window.location.reload();
      setEditingName(false);
      setNewDisplayName('');
    } catch {
      alert('Failed to update display name');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!profile) return <NotFound message="User does not exist." />;

  return (
    <div>
      <h1>{profile.username}</h1>
      
      <p>
        Status: {profile.trust_level}
        {profile.is_own_profile && profile.trust_score && (
          <> | Trust Score: {profile.trust_score.toFixed(2)} / 2.0</>
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
          <button onClick={() => window.location.href = '/username-history'} style={{ marginLeft: '10px' }}>Username History</button>
          {editingName && (
            <div style={{ marginTop: '10px' }}>
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

      {activeTab === 'stats' && profile.is_own_profile && rateLimitData.status && (
        <div>
          <p>
            Trust Score: {rateLimitData.status.trust_score.toFixed(2)} / 2.0
          </p>
          <p>Tier: {rateLimitData.status.current_tier}</p>
          
          <h3>📊 Current Limits:</h3>
          <p>✅ Posts: {rateLimitData.status.limits.posts.remaining ?? 4} / {rateLimitData.status.limits.posts.total ?? 4} remaining</p>
          <p>✅ Comments: {rateLimitData.status.limits.comments.remaining ?? 20} / {rateLimitData.status.limits.comments.total ?? 20} remaining</p>
          <p>✅ Counter Lists: {rateLimitData.status.limits.counter_lists.remaining ?? 'Unlimited'}</p>
          
          <p>🔄 Resets in: {countdown !== null ? `${Math.floor(countdown / 60)} minutes ${countdown % 60} seconds` : 'Calculating...'}</p>
          
          {rateLimitData.status.trust_score < 1.0 && (
            <p>💡 Next tier at 1.0 trust: 4 posts/hour</p>
          )}
        </div>
      )}
    </div>
  );
}
