'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface Threshold {
  _id: string;
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt';
  severity: 'warning' | 'critical';
  cooldown_minutes: number;
  enabled: boolean;
  last_triggered_at: string | null;
}

interface AlertNotification {
  _id: string;
  alert_type: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  read: boolean;
  created_at: string;
}

interface AlertHistoryItem {
  _id: string;
  metric: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  operator: 'gt' | 'lt';
  triggered_at: string;
  resolved_at: string | null;
}

const METRIC_LABELS: Record<string, string> = {
  pending_queue_depth: 'Review Queue Backlog',
  approval_rate_drop: 'Approval Rate Drop',
  zero_review_hours: 'No Reviews (hours)',
  comment_brigade: 'Comment Brigade',
  es_index_gap_pct: 'Search Index Gap %',
  restricted_user_surge: 'Restricted Users',
  new_user_spam_wave: 'New User Spam',
  scholar_ratio_collapse: 'Scholar Ratio %',
  flagged_comment_backlog: 'Flagged Backlog',
  hidden_comment_surge: 'Hidden Comments (1h)',
  post_quality_drop: 'Quality Drops (24h)',
  snapshot_staleness: 'Snapshot Staleness (h)',
};

const ALL_METRICS = Object.keys(METRIC_LABELS);

type Panel = 'thresholds' | 'notifications' | 'history';

export default function AdminAlertsPage() {
  const [activePanel, setActivePanel] = useState<Panel>('thresholds');
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [, setLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<Map<string, { value: number; severity: string }>>(new Map());

  // ─── Form state ──────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ metric: 'pending_queue_depth', threshold: 10, operator: 'gt' as 'gt' | 'lt', severity: 'warning' as 'warning' | 'critical', cooldown_minutes: 30 });

  // ─── Fetch thresholds ────────────────────────────────────────
  const fetchThresholds = useCallback(async () => {
    try {
      const data = await apiFetch<{ thresholds: Threshold[] }>('/admin/alerts/thresholds');
      setThresholds(data.thresholds);
    } catch { /* ignore */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<{ notifications: AlertNotification[] }>('/admin/alerts/notifications?limit=50&read=false');
      setNotifications(data.notifications);
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ history: AlertHistoryItem[]; pagination: { total: number } }>(`/admin/alerts/history?page=${page}&limit=20`);
      setHistory(data.history);
      setHistoryTotal(data.pagination.total);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchThresholds(); }, [fetchThresholds]);
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchHistory(historyPage); }, [fetchHistory, historyPage]);

  // Fetch active alert status
  useEffect(() => {
    const fetchActive = async () => {
      try {
        const data = await apiFetch<{ active: Array<{ metric: string; value: number; severity: string }> }>('/admin/stats/alerts');
        const map = new Map<string, { value: number; severity: string }>();
        for (const a of data.active) map.set(a.metric, { value: a.value, severity: a.severity });
        setActiveAlerts(map);
      } catch {}
    };
    fetchActive();
    const interval = setInterval(fetchActive, 30000);
    return () => clearInterval(interval);
  }, []);

  // ─── Threshold actions ───────────────────────────────────────
  const handleCreate = async () => {
    try {
      await apiFetch('/admin/alerts/thresholds', { method: 'POST', body: JSON.stringify(form) });
      setShowForm(false);
      fetchThresholds();
      toast.success('Threshold created');
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed to create threshold');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await apiFetch(`/admin/alerts/thresholds/${id}/toggle`, { method: 'PATCH' });
      fetchThresholds();
    } catch { toast.error('Toggle failed'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this threshold?')) return;
    try {
      await apiFetch(`/admin/alerts/thresholds/${id}`, { method: 'DELETE' });
      fetchThresholds();
      toast.success('Threshold deleted');
    } catch { toast.error('Delete failed'); }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/admin/alerts/notifications/read-all', { method: 'PATCH' });
      fetchNotifications();
      toast.success('All marked read');
    } catch { /* ignore */ }
  };

  const handleDismiss = async (id: string) => {
    try {
      await apiFetch(`/admin/alerts/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  // ─── Styles ───────────────────────────────────────────────────
  const SEV_C = (s: string) => (s === 'critical' ? '#d32f2f' : '#f57c00');
  const SEV_BG = (s: string) => (s === 'critical' ? '#ffcdd2' : '#ffe0b2');
  const BTN = (active: boolean) => ({
    padding: '8px 16px', border: 'none', borderBottom: active ? '2px solid #1565c0' : '2px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: active ? 'bold' : 'normal' as const,
    color: active ? '#1565c0' : '#666',
  });
  const BADGE = (s: string) => ({
    display: 'inline-block', padding: '1px 6px', borderRadius: '3px',
    background: SEV_BG(s), color: SEV_C(s), fontSize: '11px', fontWeight: 'bold',
  });

  return (
    <div>
      <h1 style={{ fontSize: '20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="BellDot" size={22} /> Alert Management</h1>

      <div style={{ display: 'flex', gap: '0', marginBottom: '16px', borderBottom: '1px solid #ddd' }}>
        <button style={BTN(activePanel === 'thresholds')} onClick={() => setActivePanel('thresholds')}>Thresholds</button>
        <button style={BTN(activePanel === 'notifications')} onClick={() => setActivePanel('notifications')}>Notifications</button>
        <button style={BTN(activePanel === 'history')} onClick={() => setActivePanel('history')}>History</button>
      </div>

      {/* ═══ THRESHOLDS ═════════════════════════════════════════ */}
      {activePanel === 'thresholds' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>{thresholds.length} thresholds configured</span>
            <button onClick={() => setShowForm(!showForm)} style={{ padding: '6px 16px', background: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
              {showForm ? 'Cancel' : '+ Add Threshold'}
            </button>
          </div>

          {showForm && (
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '6px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Metric</label>
                  <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                    {ALL_METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Threshold</label>
                  <input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseInt(e.target.value) || 0 })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Operator</label>
                  <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as 'gt' | 'lt' })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                    <option value="gt">greater than</option>
                    <option value="lt">less than</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as 'warning' | 'critical' })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Cooldown (min)</label>
                  <input type="number" value={form.cooldown_minutes} onChange={(e) => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 5 })} style={{ width: '100%', padding: '6px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={handleCreate} style={{ padding: '6px 20px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>Create</button>
                </div>
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Metric</th>
                <th style={{ padding: '8px' }}>Condition</th>
                <th style={{ padding: '8px' }}>Severity</th>
                <th style={{ padding: '8px' }}>Live Status</th>
                <th style={{ padding: '8px' }}>Cooldown</th>
                <th style={{ padding: '8px' }}>Enabled</th>
                <th style={{ padding: '8px' }}>Last Triggered</th>
                <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{METRIC_LABELS[t.metric] || t.metric}</td>
                  <td style={{ padding: '8px' }}>
                    <code>{t.operator} {t.threshold}</code>
                  </td>
                  <td style={{ padding: '8px' }}><span style={BADGE(t.severity)}>{t.severity}</span></td>
                  <td style={{ padding: '8px' }}>
                    {(() => {
                      const active = activeAlerts.get(t.metric);
                      if (!t.enabled) return <span title="Disabled">⚫</span>;
                      if (active && active.severity === 'critical') return <span style={{ fontSize: '18px' }} title={`Active: ${active.value}`}>🔴</span>;
                      if (active && active.severity === 'warning') return <span style={{ fontSize: '18px' }} title={`Active: ${active.value}`}>🟠</span>;
                      return <span style={{ fontSize: '18px' }} title="Normal">🟢</span>;
                    })()}
                  </td>
                  <td style={{ padding: '8px', color: '#666' }}>{t.cooldown_minutes}m</td>
                  <td style={{ padding: '8px' }}>
                    <button onClick={() => handleToggle(t._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title={t.enabled ? 'Disable' : 'Enable'}>
                      {t.enabled ? '🟢' : '⚫'}
                    </button>
                  </td>
                  <td style={{ padding: '8px', color: '#999', fontSize: '11px' }}>
                    {t.last_triggered_at ? new Date(t.last_triggered_at).toLocaleString() : 'Never'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button onClick={() => handleDelete(t._id)} style={{ background: 'none', border: 'none', color: '#c62828', cursor: 'pointer', fontSize: '13px' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {thresholds.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No thresholds configured. Add one to start monitoring.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ NOTIFICATIONS ═══════════════════════════════════════ */}
      {activePanel === 'notifications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>{notifications.length} unread notifications</span>
            {notifications.length > 0 && (
              <button onClick={handleMarkAllRead} style={{ padding: '6px 16px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                Mark All Read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>✅ No unread alert notifications</div>
          ) : (
            <div>
              {notifications.map((n) => (
                <div key={n._id} style={{ padding: '10px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={BADGE(n.severity)}>{n.severity}</span>
                      <strong style={{ fontSize: '13px' }}>{METRIC_LABELS[n.alert_type] || n.alert_type}</strong>
                    </div>
                    <div style={{ fontSize: '13px', color: '#555', marginBottom: '2px' }}>{n.message}</div>
                    <div style={{ fontSize: '11px', color: '#999' }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                  <button onClick={() => handleDismiss(n._id)} style={{ background: 'none', border: '1px solid #ddd', padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', color: '#666', flexShrink: 0 }}>
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ HISTORY ══════════════════════════════════════════════ */}
      {activePanel === 'history' && (
        <div>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
            {historyTotal} total records · Page {historyPage} of {Math.ceil(historyTotal / 20) || 1}
            {historyPage > 1 && <button onClick={() => setHistoryPage((p) => p - 1)} style={{ marginLeft: '12px', padding: '2px 10px', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>← Prev</button>}
            {historyTotal > historyPage * 20 && <button onClick={() => setHistoryPage((p) => p + 1)} style={{ marginLeft: '4px', padding: '2px 10px', border: '1px solid #ddd', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}>Next →</button>}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                <th style={{ padding: '8px' }}>Metric</th>
                <th style={{ padding: '8px' }}>Value</th>
                <th style={{ padding: '8px' }}>Triggered</th>
                <th style={{ padding: '8px' }}>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px' }}>
                    <span style={BADGE(h.severity)}>{h.severity}</span>{' '}
                    <strong>{METRIC_LABELS[h.metric] || h.metric}</strong>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {h.operator} {h.threshold} (got {h.value})
                    </div>
                  </td>
                  <td style={{ padding: '8px' }}><code>{h.value}</code></td>
                  <td style={{ padding: '8px' }}>{new Date(h.triggered_at).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>
                    {h.resolved_at ? (
                      <span style={{ color: '#2e7d32', fontSize: '12px' }}>✅ {new Date(h.resolved_at).toLocaleString()}</span>
                    ) : (
                      <span style={{ color: '#d32f2f', fontSize: '12px' }}>🔴 Unresolved</span>
                    )}
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>No alert history yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
