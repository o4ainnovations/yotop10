'use client';

import { useState, useEffect, use } from 'react';
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
  const { username } = use(params);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'comments'>('posts');
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  useEffect(() => {
    // Initialize fingerprint for auth check
    getFingerprint();

    API.getUserProfile(username)
      .then((data: any) => {
        setProfile(data);
      })
      .catch(() => {
        notFound();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [username]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) return;
    
    try {
      await API.updateDisplayName(newDisplayName);
      const updated = await API.getUserProfile(username) as any;
      setProfile(updated);
      setEditingName(false);
      setNewDisplayName('');
    } catch {
      alert('Failed to update display name');
    }
  };

  const getTrustBadgeColor = (level: string) => {
    switch (level) {
      case 'scholar': return { bg: '#e6f7ed', text: '#0e6245' };
      case 'troll': return { bg: '#ffebee', text: '#c62828' };
      default: return { bg: '#f5f5f5', text: '#666' };
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'approved': return { bg: '#e6f7ed', text: '#0e6245' };
      case 'pending_review': return { bg: '#fff3e0', text: '#ef6c00' };
      case 'rejected': return { bg: '#ffebee', text: '#c62828' };
      default: return { bg: '#f5f5f5', text: '#666' };
    }
  };

  if (loading) return <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>Loading...</div>;
  if (!profile) return null;

  const trustColors = getTrustBadgeColor(profile.trust_level);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <h1>YoTop10</h1>
        <nav>
          <Link href="/">Home</Link> | <Link href="/categories">Categories</Link>
        </nav>
      </header>

      <main>
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <h1 style={{ margin: 0 }}>{profile.username}</h1>
            <span style={{ 
              padding: '4px 12px', 
              borderRadius: '20px', 
              backgroundColor: trustColors.bg, 
              color: trustColors.text,
              fontSize: '14px',
              textTransform: 'capitalize'
            }}>
              {profile.trust_level}
            </span>
          </div>

          {profile.is_own_profile && profile.trust_score && (
            <p style={{ color: '#666', margin: '5px 0' }}>
              Trust Score: {profile.trust_score.toFixed(2)} / 2.0
            </p>
          )}

          <div style={{ display: 'flex', gap: '30px', margin: '15px 0' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{profile.stats.total_posts}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Posts</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{profile.stats.total_comments}</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Comments</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{profile.stats.approval_rate}%</div>
              <div style={{ color: '#666', fontSize: '14px' }}>Approval Rate</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {new Date(profile.stats.member_since).toLocaleDateString()}
              </div>
              <div style={{ color: '#666', fontSize: '14px' }}>Member Since</div>
            </div>
          </div>

          {profile.is_own_profile && (
            <div style={{ marginTop: '20px' }}>
              {!editingName ? (
                <button 
                  onClick={() => setEditingName(true)}
                  style={{ padding: '8px 16px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Edit Display Name
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="a_newname"
                    style={{ padding: '8px', width: '200px' }}
                    maxLength={32}
                  />
                  <button 
                    onClick={handleUpdateDisplayName}
                    style={{ padding: '8px 16px', backgroundColor: '#0066cc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditingName(false)}
                    style={{ padding: '8px 16px', backgroundColor: '#ccc', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Secure My Authority</h3>
                <p style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>
                  Generate your seed phrase to carry your reputation to new devices. We do not store this.
                </p>
                <button disabled style={{ padding: '8px 16px', backgroundColor: '#ccc', cursor: 'not-allowed' }}>
                  Generate Identity Key (Coming Soon)
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderBottom: '1px solid #eee', marginBottom: '20px' }}>
          <button 
            onClick={() => setActiveTab('posts')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              backgroundColor: activeTab === 'posts' ? '#f0f0f0' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'posts' ? 'bold' : 'normal'
            }}
          >
            Posts ({profile.posts.length})
          </button>
          <button 
            onClick={() => setActiveTab('comments')}
            style={{ 
              padding: '10px 20px', 
              border: 'none', 
              backgroundColor: activeTab === 'comments' ? '#f0f0f0' : 'transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'comments' ? 'bold' : 'normal'
            }}
          >
            Comments ({profile.comments.length})
          </button>
        </div>

        {activeTab === 'posts' && (
          <div>
            {profile.posts.length === 0 ? (
              <p style={{ color: '#666' }}>No posts yet.</p>
            ) : (
              profile.posts.map((post) => {
                const statusColors = getStatusBadgeColor(post.status);
                return (
                  <div key={post.id} style={{ 
                    padding: '15px', 
                    border: '1px solid #eee', 
                    borderRadius: '5px', 
                    marginBottom: '15px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <Link href={`/${post.slug}`} style={{ fontWeight: 'bold', fontSize: '18px' }}>
                        {post.title}
                      </Link>
                      {profile.is_own_profile && (
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '10px', 
                          fontSize: '12px',
                          backgroundColor: statusColors.bg,
                          color: statusColors.text,
                          textTransform: 'capitalize'
                        }}>
                          {post.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '20px', color: '#666', fontSize: '14px' }}>
                      <span>{post.category?.name || 'Uncategorized'}</span>
                      <span>🔥 {post.fire_count}</span>
                      <span>💬 {post.comment_count}</span>
                      <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'comments' && (
          <div>
            {profile.comments.length === 0 ? (
              <p style={{ color: '#666' }}>No comments yet.</p>
            ) : (
              profile.comments.map((comment) => (
                <div key={comment.id} style={{ 
                  padding: '15px', 
                  border: '1px solid #eee', 
                  borderRadius: '5px', 
                  marginBottom: '15px' 
                }}>
                  <p style={{ margin: '0 0 10px 0' }}>{comment.content}</p>
                  <div style={{ display: 'flex', gap: '20px', color: '#666', fontSize: '14px' }}>
                    <span>🔥 {comment.fire_count}</span>
                    <span>💬 {comment.reply_count}</span>
                    <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '10px', textAlign: 'center', color: '#666' }}>
        <p>YoTop10 - Open Platform for Top 10 Lists</p>
      </footer>
    </div>
  );
}
