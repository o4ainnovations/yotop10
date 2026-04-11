'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { API } from '@/lib/api';
import { getFingerprint } from '@/lib/fingerprint';

interface UserProfile {
  username: string;
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
    fire_count: number;
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
      try {
      const data = await API.getUserProfile(username) as any;
      setProfile(data);
      } catch {
        notFound();
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
      const { username } = await params;
      const updated = await API.getUserProfile(username) as any;
      setProfile(updated);
      setEditingName(false);
      setNewDisplayName('');
    } catch {
      alert('Failed to update display name');
    }
  };

    switch (level) {
      case 'scholar': return { bg: '#e6f7ed', text: '#0e6245' };
      case 'troll': return { bg: '#ffebee', text: '#c62828' };
      default: return { bg: '#f5f5f5', text: '#666' };
    }
  };

    switch (status) {
      case 'approved': return { bg: '#e6f7ed', text: '#0e6245' };
      case 'pending_review': return { bg: '#fff3e0', text: '#ef6c00' };
      case 'rejected': return { bg: '#ffebee', text: '#c62828' };
      default: return { bg: '#f5f5f5', text: '#666' };
    }
  };

  if (loading) return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>Loading...</div>;
  if (!profile) return null;


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
        <div>
          <button onClick={() => setEditingName(true)}>Edit Display Name</button>
          {editingName && (
            <div>
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
                  🔥 {post.fire_count} | 
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
