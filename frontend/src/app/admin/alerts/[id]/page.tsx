'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';

interface AlertDetail {
  notification: {
    _id: string; alert_type: string; severity: 'warning' | 'critical';
    title: string; message: string; value: number; threshold: number;
    settled: boolean; settled_at: string | null; created_at: string;
  };
  current_value: number | null;
  threshold_config: { threshold: number; operator: string; severity: string; _id: string } | null;
  active: boolean;
  still_breaching: boolean;
}

const METRIC_LABELS: Record<string, string> = {
  pending_queue_depth: 'Review Queue Backlog',
  approval_rate_drop: 'Approval Rate Drop',
  zero_review_hours: 'No Reviews (hours)',
  comment_brigade: 'Comment Brigade Detected',
  es_index_gap_pct: 'Search Index Gap %',
  restricted_user_surge: 'Restricted User Surge',
  new_user_spam_wave: 'New User Spam Wave',
  scholar_ratio_collapse: 'Scholar Ratio Collapse',
  flagged_comment_backlog: 'Flagged Comment Backlog',
  hidden_comment_surge: 'Hidden Comment Surge',
  post_quality_drop: 'Post Quality Drop',
  snapshot_staleness: 'Snapshot Staleness (hours)',
};

const RESOLUTION_GUIDE: Record<string, string> = {
  pending_queue_depth: 'Approve or reject pending posts in the review queue to reduce the backlog.',
  approval_rate_drop: 'Too many posts are being rejected vs approved. Review rejection quality — are valid posts being rejected? Or is submission quality actually dropping?',
  zero_review_hours: 'No admin activity detected. Log in and review at least one post to reset this metric.',
  comment_brigade: 'A comment thread is growing rapidly. Check the thread for coordinated attacks or spam. Consider locking the post.',
  es_index_gap_pct: 'Some documents exist in the database but are missing from Elasticsearch. Trigger a reindex from the search management panel.',
  restricted_user_surge: 'Many users have active posting restrictions. Review whether the penalty system is too aggressive.',
  new_user_spam_wave: 'Multiple new accounts are submitting posts rapidly. Review these submissions for spam patterns.',
  scholar_ratio_collapse: 'The percentage of users with high trust scores is dropping. This may indicate community health issues or trust score system problems.',
  flagged_comment_backlog: 'Flagged comments are accumulating without review. Review and clear the flagged queue.',
  hidden_comment_surge: 'Many comments were hidden in the last hour. This could indicate a spam wave or over-aggressive moderation.',
  post_quality_drop: 'Recently approved posts have very short introductions. Review quality standards for new approvals.',
  snapshot_staleness: 'The analytics snapshot has not been generated for a long time. This may indicate a cron job failure.',
};

export default function AlertDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    apiFetch<AlertDetail>(`/admin/alerts/notifications/${params.id}`)
      .then(setDetail)
      .catch(() => toast.error('Failed to load alert'))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSettle = async () => {
    setSettling(true);
    try {
      await apiFetch(`/admin/alerts/notifications/${params.id}/settle`, { method: 'PATCH' });
      setDetail(prev => prev ? {
        ...prev,
        notification: { ...prev.notification, settled: true, settled_at: new Date().toISOString() },
      } : null);
      toast.success('Alert settled');
    } catch { toast.error('Failed to settle alert'); }
    setSettling(false);
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!detail) return <div style={{ padding: '20px' }}>Alert not found</div>;

  const { notification: n, current_value, threshold_config: tc, still_breaching } = detail;
  const STATUS = still_breaching ? (n.severity === 'critical' ? '🔴 Critical' : '🟠 Warning') : '🟢 Resolved';
  const STATUS_COLOR = still_breaching ? (n.severity === 'critical' ? '#d32f2f' : '#f57c00') : '#2e7d32';
  const STATUS_BG = still_breaching ? (n.severity === 'critical' ? '#ffcdd2' : '#fff3e0') : '#e8f5e9';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
        ← Back
      </button>

      <div style={{ background: STATUS_BG, border: `2px solid ${STATUS_COLOR}`, borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', margin: '0 0 8px' }}>
          {STATUS} — {METRIC_LABELS[n.alert_type] || n.alert_type}
        </h1>
        <p style={{ fontSize: '14px', color: '#555', margin: '0 0 8px' }}>{n.message}</p>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', marginTop: '12px' }}>
          <div>
            <span style={{ color: '#999' }}>Triggered at:</span>{' '}
            <strong>{new Date(n.created_at).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: '#999' }}>Value:</span>{' '}
            <strong style={{ color: STATUS_COLOR }}>{n.value}</strong>
            {' '}vs threshold {n.threshold}
          </div>
          {current_value !== null && (
            <div>
              <span style={{ color: '#999' }}>Current:</span>{' '}
              <strong style={{ color: still_breaching ? STATUS_COLOR : '#2e7d32' }}>{current_value}</strong>
            </div>
          )}
        </div>
        {n.settled && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#2e7d32' }}>
            ✅ Settled on {new Date(n.settled_at!).toLocaleString()}
          </div>
        )}
      </div>

      {/* Resolution Guide */}
      <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>How to Fix</h2>
        <p style={{ fontSize: '13px', color: '#555', lineHeight: '1.6', margin: 0 }}>
          {RESOLUTION_GUIDE[n.alert_type] || 'Review the metric and take appropriate action.'}
        </p>
      </div>

      {/* Threshold Config */}
      {tc && (
        <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '16px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 8px' }}>Threshold Configuration</h2>
          <div style={{ fontSize: '13px', color: '#555' }}>
            <p style={{ margin: '4px 0' }}>Operator: <strong>{tc.operator}</strong></p>
            <p style={{ margin: '4px 0' }}>Threshold: <strong>{tc.threshold}</strong></p>
            <p style={{ margin: '4px 0' }}>Severity: <span style={{ color: tc.severity === 'critical' ? '#d32f2f' : '#f57c00', fontWeight: 'bold' }}>{tc.severity}</span></p>
            <button onClick={() => router.push('/admin/alerts')} style={{ marginTop: '8px', padding: '4px 12px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
              Manage Thresholds →
            </button>
          </div>
        </div>
      )}

      {!n.settled && (
        <button
          onClick={handleSettle}
          disabled={settling}
          style={{ padding: '10px 24px', background: settling ? '#ccc' : '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', cursor: settling ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 'bold', width: '100%' }}
        >
          {settling ? 'Settling...' : '✅ Settle This Alert'}
        </button>
      )}
    </div>
  );
}
