'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';
import NotFound from '../../not-found';

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
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');
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
  }, [params]);

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
  if (!profile) return <NotFound />;

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
    </div>
  );
}
