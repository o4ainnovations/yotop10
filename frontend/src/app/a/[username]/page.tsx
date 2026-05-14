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

  if (!profile) return <NotFound message="User does not exist." />;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      maxWidth: '900px',
      margin: '0 auto',
      padding: '32px 20px 60px',
    }}>
      {/* Profile Header Card */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        padding: '32px',
        marginBottom: '24px',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          margin: '0 0 8px 0',
          letterSpacing: '-0.02em',
        }}>
          {profile.username}
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          margin: '0 0 12px 0',
        }}>
          <span style={{
            display: 'inline-block',
            background: profile.trust_level === 'scholar' ? '#e8f5e9' :
                        profile.trust_level === 'troll' ? '#ffebee' : '#fff8e1',
            color: profile.trust_level === 'scholar' ? '#2e7d32' :
                   profile.trust_level === 'troll' ? '#c62828' : '#f57f17',
            padding: '2px 10px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {profile.trust_level}
          </span>
          {profile.is_own_profile && authUser && (
            <span style={{ marginLeft: '12px', color: 'var(--text-secondary)' }}>
              Trust Score: {authUser.trust_score.toFixed(2)} / 2.0
            </span>
          )}
        </p>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 20px',
          color: 'var(--text-secondary)',
          fontSize: '14px',
        }}>
          <span><Icon name="MessageCircle" size={14} color="var(--text-muted)" /> {profile.stats.total_posts} posts</span>
          <span><Icon name="MessageCircle" size={14} color="var(--text-muted)" /> {profile.stats.total_comments} comments</span>
          <span>{profile.stats.approval_rate}% approval</span>
          <span>Member since {new Date(profile.stats.member_since).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Own Profile Actions */}
      {profile.is_own_profile && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: '24px 32px',
          marginBottom: '24px',
        }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setEditingName(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              Edit Display Name
            </button>
            <button
              onClick={() => router.push('/username-history')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all var(--transition)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.color = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
            >
              Username History
            </button>
          </div>

          {editingName && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
            }}>
              {nameError && (
                <div role="alert" style={{
                  color: '#d32f2f',
                  fontSize: '14px',
                  marginBottom: '10px',
                  padding: '8px 12px',
                  background: '#ffebee',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #f44336',
                }}>
                  {nameError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="a_newname"
                  maxLength={32}
                  style={{
                    flex: '1 1 200px',
                    padding: '11px 14px',
                    background: 'var(--bg-primary)',
                    border: '1.5px solid var(--border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color var(--transition)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                />
                <button
                  onClick={handleUpdateDisplayName}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--accent-gradient)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--border-primary)',
        marginBottom: '24px',
      }}>
        <button
          onClick={() => setActiveTab('posts')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'posts' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'posts' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: activeTab === 'posts' ? 600 : 400,
            cursor: 'pointer',
            transition: 'color var(--transition), border-color var(--transition)',
          }}
        >
          Posts ({profile.posts.length})
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'comments' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'comments' ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: '14px',
            fontWeight: activeTab === 'comments' ? 600 : 400,
            cursor: 'pointer',
            transition: 'color var(--transition), border-color var(--transition)',
          }}
        >
          Comments ({profile.comments.length})
        </button>
        {profile.is_own_profile && (
          <button
            onClick={() => setActiveTab('stats')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'stats' ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === 'stats' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: activeTab === 'stats' ? 600 : 400,
              cursor: 'pointer',
              transition: 'color var(--transition), border-color var(--transition)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Icon name="Star" size={14} color="#f57c00" /> Stats
          </button>
        )}
      </div>

      {/* Posts Tab */}
      {activeTab === 'posts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {profile.posts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', textAlign: 'center', padding: '40px 0' }}>
              No posts yet.
            </p>
          ) : (
            profile.posts.map((post) => (
              <div key={post.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px 24px',
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
                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 600, lineHeight: 1.4 }}>
                  <Link
                    href={`/${post.slug}`}
                    style={{
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      transition: 'color var(--transition)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                  >
                    {post.title}
                  </Link>
                </h3>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 14px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}>
                  <span>{post.category?.name || 'Uncategorized'}</span>
                  <span>
                    <Icon name="MessageCircle" size={12} color="var(--text-muted)" /> {post.comment_count}
                  </span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                  {profile.is_own_profile && (
                    <span style={{
                      fontWeight: 600,
                      fontSize: '12px',
                      color: post.status === 'approved' ? '#2e7d32' :
                             post.status === 'rejected' ? '#c62828' :
                             post.revision_guidance ? '#e65100' : '#f57f17',
                    }}>
                      {post.revision_guidance ? 'Revision Requested' : post.status.replace('_', ' ')}
                    </span>
                  )}
                </div>
                {profile.is_own_profile && post.rejection_reason && (
                  <div style={{
                    backgroundColor: '#ffebee',
                    border: '1px solid #f44336',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '12px',
                    fontSize: '13px',
                    color: '#c62828',
                  }}>
                    <strong>Reason:</strong> {post.rejection_reason}
                  </div>
                )}
                {profile.is_own_profile && post.revision_guidance && (
                  <div style={{
                    backgroundColor: '#fff3e0',
                    border: '1px solid #ff9800',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginTop: '12px',
                    fontSize: '13px',
                    color: '#e65100',
                  }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {profile.comments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', textAlign: 'center', padding: '40px 0' }}>
              No comments yet.
            </p>
          ) : (
            profile.comments.map((comment) => (
              <div key={comment.id} style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
                padding: '20px 24px',
              }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {comment.content}
                </p>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '8px 14px',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                }}>
                  <span>
                    <Icon name="Flame" size={12} color="#e65100" /> {comment.fire_count}
                  </span>
                  <span>
                    <Icon name="MessageCircle" size={12} color="var(--text-muted)" /> {comment.reply_count}
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
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          padding: '28px 32px',
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Trust Score:</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {rateLimitStatus.trust_score.toFixed(2)} / 2.0
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '14px 18px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Tier:</span>
              <span style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                textTransform: 'capitalize',
                padding: '2px 10px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-primary)',
              }}>
                {rateLimitStatus.current_tier}
              </span>
            </div>

            <h3 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '20px 0 4px 0',
            }}>
              <Icon name="ChartBar" size={16} color="var(--text-muted)" />
              Current Limits
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                <Icon name="Check" size={14} color="#2e7d32" />
                Posts: {rateLimitStatus.limits.posts.remaining} / {rateLimitStatus.limits.posts.total} remaining
              </p>
              <p style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                <Icon name="Check" size={14} color="#2e7d32" />
                Comments: {rateLimitStatus.limits.comments.remaining} / {rateLimitStatus.limits.comments.total} remaining
              </p>
              <p style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                <Icon name="Check" size={14} color="#2e7d32" />
                Counter Lists: {rateLimitStatus.limits.counter_lists.remaining}
              </p>
            </div>

            <p style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '4px 0 0 0',
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}>
              <Icon name="RefreshCw" size={14} color="var(--text-muted)" />
              Resets in: {rateLimitCountdown !== null
                ? `${Math.floor(rateLimitCountdown / 60)} minutes ${rateLimitCountdown % 60} seconds`
                : 'Calculating...'}
            </p>

            <p style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: 0,
              fontSize: '14px',
              color: 'var(--text-muted)',
            }}>
              <Icon name="Lightbulb" size={14} color="#f57c00" />
              Next tier at 1.0 trust: 4 posts/hour
            </p>
          </div>
        </div>
      )}

      {/* Secure My Authority */}
      {profile.is_own_profile && (
        <div style={{ marginTop: '32px' }}>
          <SecureMyAuthority />
        </div>
      )}
    </div>
  );
}
