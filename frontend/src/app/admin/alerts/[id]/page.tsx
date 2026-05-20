'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

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
  approval_rate_drop: 'Too many posts are being rejected vs approved. Review rejection quality mdash are valid posts being rejected? Or is submission quality actually dropping?',
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

  if (loading) return <div className="p-5 text-white/40">Loading...</div>;
  if (!detail) return <div className="p-5 text-white/40">Alert not found</div>;

  const { notification: n, current_value, threshold_config: tc, still_breaching } = detail;

  const severityBorder = still_breaching
    ? (n.severity === 'critical' ? 'border-red-500 bg-red-500/10' : 'border-orange-500 bg-orange-500/10')
    : 'border-green-500 bg-green-500/10';
  const severityTextColor = still_breaching
    ? (n.severity === 'critical' ? 'text-red-500' : 'text-orange-500')
    : 'text-green-500';

  const STATUS_ICON = still_breaching
    ? (n.severity === 'critical'
      ? <><Icon name="Circle" size={16} color="#d32f2f" fill="#d32f2f" /> Critical</>
      : <><Icon name="Circle" size={16} color="#f57c00" fill="#f57c00" /> Warning</>)
    : <><Icon name="Circle" size={16} color="#2e7d32" fill="#2e7d32" /> Resolved</>;

  const cardClass = 'bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5 mb-4 w-full';

  return (
    <div className="w-full px-3 sm:px-5 py-5">
      <button onClick={() => router.back()} className="bg-transparent border-none text-orange-400 cursor-pointer text-sm mb-4 flex items-center gap-1 hover:text-orange-300 min-h-[44px]">
        <Icon name="ArrowLeft" size={14} /> Back
      </button>

      <div className={`border-2 rounded-2xl p-5 mb-5 ${severityBorder}`}>
        <h1 className="text-xl font-bold mb-2 flex items-center gap-2 text-white flex-wrap">
          {STATUS_ICON} mdash {METRIC_LABELS[n.alert_type] || n.alert_type}
        </h1>
        <p className="text-sm text-white/50 mb-2">{n.message}</p>
        <div className="flex gap-5 flex-wrap text-[13px] mt-3">
          <div>
            <span className="text-white/40">Triggered at:</span>{' '}
            <strong className="text-white">{new Date(n.created_at).toLocaleString()}</strong>
          </div>
          <div>
            <span className="text-white/40">Value:</span>{' '}
            <strong className={severityTextColor}>{n.value}</strong>
            {' '}vs threshold {n.threshold}
          </div>
          {current_value !== null && (
            <div>
              <span className="text-white/40">Current:</span>{' '}
              <strong className={still_breaching ? severityTextColor : 'text-green-500'}>{current_value}</strong>
            </div>
          )}
        </div>
        {n.settled && (
          <div className="mt-3 text-[13px] text-green-400 flex items-center gap-1">
            <Icon name="Check" size={14} color="#2e7d32" /> Settled on {new Date(n.settled_at!).toLocaleString()}
          </div>
        )}
      </div>

      <div className={cardClass}>
        <h2 className="text-base font-bold mb-2 text-white">How to Fix</h2>
        <p className="text-[13px] text-white/50 leading-relaxed">
          {RESOLUTION_GUIDE[n.alert_type] || 'Review the metric and take appropriate action.'}
        </p>
      </div>

      {tc && (
        <div className={cardClass}>
          <h2 className="text-base font-bold mb-2.5 text-white">Threshold Configuration</h2>
          <div className="text-[13px] text-white/50">
            <p className="my-1">Operator: <strong className="text-white">{tc.operator}</strong></p>
            <p className="my-1">Threshold: <strong className="text-white">{tc.threshold}</strong></p>
            <p className="my-1">Severity: <span className={`font-bold ${tc.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>{tc.severity}</span></p>
            <button onClick={() => router.push('/admin/alerts')} className="mt-2.5 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white border-none rounded-xl cursor-pointer text-[13px] font-bold min-h-[36px]">
              Manage Thresholds <Icon name="ArrowRight" size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Sticky bottom resolve button */}
      {!n.settled && (
        <div className="sticky bottom-0 z-10 bg-zinc-950/95 backdrop-blur-sm pt-3 pb-4 -mx-3 sm:-mx-5 px-3 sm:px-5">
          <button
            onClick={handleSettle}
            disabled={settling}
            className={`w-full py-3 text-white border-none rounded-xl cursor-pointer text-[15px] font-bold flex items-center justify-center gap-2 min-h-[48px] ${settling ? 'bg-white/10 cursor-not-allowed' : 'bg-green-700 cursor-pointer hover:bg-green-600'}`}
          >
            {settling ? 'Settling...' : <><Icon name="Check" size={16} color="#fff" /> Settle This Alert</>}
          </button>
        </div>
      )}
    </div>
  );
}
