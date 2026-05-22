'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';
import { formatDate, formatTime } from '@/lib/dates';

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

function severityBadgeClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
    : 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
}

function tabClass(active: boolean): string {
  return `px-4 py-2.5 border-none bg-transparent cursor-pointer text-sm min-h-11 transition-colors ${
    active
      ? 'font-bold text-orange-400 border-b-2 border-orange-400'
      : 'text-white/40 border-b-2 border-transparent hover:text-white/60'
  }`;
}

function inputClass(): string {
  return 'w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 outline-none focus:border-orange-500/50 min-h-9';
}

function selectClass(): string {
  return 'w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm outline-none focus:border-orange-500/50 min-h-9';
}

export default function AdminAlertsPage() {
  const [activePanel, setActivePanel] = useState<Panel>('thresholds');
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [history, setHistory] = useState<AlertHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [, setLoading] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<Map<string, { value: number; severity: string }>>(new Map());

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ metric: 'pending_queue_depth', threshold: 10, operator: 'gt' as 'gt' | 'lt', severity: 'warning' as 'warning' | 'critical', cooldown_minutes: 30 });

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

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
        <Icon name="BellDot" size={22} /> Alert Management
      </h1>

      {/* Tab bar */}
      <div className="flex gap-0 mb-5 border-b border-white/10 flex-wrap">
        <button onClick={() => setActivePanel('thresholds')} className={tabClass(activePanel === 'thresholds')}>Thresholds</button>
        <button onClick={() => setActivePanel('notifications')} className={tabClass(activePanel === 'notifications')}>Notifications</button>
        <button onClick={() => setActivePanel('history')} className={tabClass(activePanel === 'history')}>History</button>
      </div>

      {/* ═══ THRESHOLDS ═════════════════════════════════════════ */}
      {activePanel === 'thresholds' && (
        <div>
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <span className="text-sm text-white/40">{thresholds.length} thresholds configured</span>
            <button
              onClick={() => setShowForm(!showForm)}
              className={`px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer min-h-9 transition-colors ${
                showForm ? 'bg-white/10 border border-white/20' : 'bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600'
              }`}
            >
              {showForm ? 'Cancel' : '+ Add Threshold'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1">Metric</label>
                  <select value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} className={selectClass()}>
                    {ALL_METRICS.map((m) => <option key={m} value={m} className="bg-zinc-900">{METRIC_LABELS[m]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Threshold</label>
                  <input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseInt(e.target.value) || 0 })} className={inputClass()} />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Operator</label>
                  <select value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value as 'gt' | 'lt' })} className={selectClass()}>
                    <option value="gt" className="bg-zinc-900">greater than</option>
                    <option value="lt" className="bg-zinc-900">less than</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as 'warning' | 'critical' })} className={selectClass()}>
                    <option value="warning" className="bg-zinc-900">Warning</option>
                    <option value="critical" className="bg-zinc-900">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1">Cooldown (min)</label>
                  <input type="number" value={form.cooldown_minutes} onChange={(e) => setForm({ ...form, cooldown_minutes: parseInt(e.target.value) || 5 })} className={inputClass()} />
                </div>
                <div className="flex items-end">
                  <button onClick={handleCreate} className="px-5 py-1.5 rounded-lg text-white text-xs font-bold cursor-pointer bg-green-700 hover:bg-green-600 transition-colors min-h-9">
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mobile: card stack */}
          <div className="lg:hidden space-y-2">
            {thresholds.map((t) => {
              const active = activeAlerts.get(t.metric);
              return (
                <div key={t._id} className="bg-white/5 border border-white/5 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white font-bold text-sm">{METRIC_LABELS[t.metric] || t.metric}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase ${severityBadgeClass(t.severity)}`}>
                      {t.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap">
                    <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-xs">{t.operator} {t.threshold}</code>
                    <span>{t.cooldown_minutes}m cooldown</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/40">Status:</span>
                    {!t.enabled ? (
                      <Icon name="Circle" size={14} color="#999" />
                    ) : active && active.severity === 'critical' ? (
                      <Icon name="Circle" size={14} color="#d32f2f" fill="#d32f2f" />
                    ) : active && active.severity === 'warning' ? (
                      <Icon name="Circle" size={14} color="#f57c00" fill="#f57c00" />
                    ) : (
                      <Icon name="Circle" size={14} color="#2e7d32" fill="#2e7d32" />
                    )}
                  </div>
                  <div className="text-3xs text-white/30" suppressHydrationWarning>
                    {t.last_triggered_at ? `Last: ${formatDate(t.last_triggered_at)} ${formatTime(t.last_triggered_at)}` : 'Never triggered'}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleToggle(t._id)}
                      className="px-2.5 py-1 rounded-md text-3xs bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-8 text-white/60 flex items-center gap-1"
                    >
                      {t.enabled ? (
                        <><Icon name="Circle" size={11} color="#2e7d32" fill="#2e7d32" /> Enabled</>
                      ) : (
                        <><Icon name="Circle" size={11} color="#999" /> Disabled</>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(t._id)}
                      className="px-2.5 py-1 rounded-md text-3xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer min-h-8"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {thresholds.length === 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-white/40 text-sm">No thresholds configured. Add one to start monitoring.</p>
              </div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-sm2">
              <thead>
                <tr className="border-b-2 border-white/10 text-left text-white/40">
                  <th className="p-2.5">Metric</th>
                  <th className="p-2.5">Condition</th>
                  <th className="p-2.5">Severity</th>
                  <th className="p-2.5">Live Status</th>
                  <th className="p-2.5">Cooldown</th>
                  <th className="p-2.5">Enabled</th>
                  <th className="p-2.5">Last Triggered</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {thresholds.map((t) => {
                  const active = activeAlerts.get(t.metric);
                  return (
                    <tr key={t._id} className="border-b border-white/5">
                      <td className="p-2.5 font-bold text-white">{METRIC_LABELS[t.metric] || t.metric}</td>
                      <td className="p-2.5">
                        <code className="text-white/60">{t.operator} {t.threshold}</code>
                      </td>
                      <td className="p-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase ${severityBadgeClass(t.severity)}`}>{t.severity}</span>
                      </td>
                      <td className="p-2.5">
                        {!t.enabled ? (
                          <Icon name="Circle" size={14} color="#999" />
                        ) : active && active.severity === 'critical' ? (
                          <Icon name="Circle" size={16} color="#d32f2f" fill="#d32f2f" />
                        ) : active && active.severity === 'warning' ? (
                          <Icon name="Circle" size={16} color="#f57c00" fill="#f57c00" />
                        ) : (
                          <Icon name="Circle" size={16} color="#2e7d32" fill="#2e7d32" />
                        )}
                      </td>
                      <td className="p-2.5 text-white/40">{t.cooldown_minutes}m</td>
                      <td className="p-2.5">
                        <button onClick={() => handleToggle(t._id)} className="bg-transparent border-none cursor-pointer min-h-8 min-w-[32px]">
                          {t.enabled ? <Icon name="Circle" size={16} color="#2e7d32" fill="#2e7d32" /> : <Icon name="Circle" size={16} color="#999" />}
                        </button>
                      </td>
                      <td className="p-2.5 text-white/30 text-3xs">
                        <span suppressHydrationWarning>{t.last_triggered_at ? `${formatDate(t.last_triggered_at)} ${formatTime(t.last_triggered_at)}` : 'Never'}</span>
                      </td>
                      <td className="p-2.5 text-right">
                        <button onClick={() => handleDelete(t._id)} className="bg-transparent border-none text-red-400 cursor-pointer text-xs hover:text-red-300 min-h-8">Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {thresholds.length === 0 && (
                  <tr><td colSpan={8} className="p-6 text-center text-white/40">No thresholds configured. Add one to start monitoring.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ NOTIFICATIONS ═══════════════════════════════════════ */}
      {activePanel === 'notifications' && (
        <div>
          <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
            <span className="text-sm text-white/40">{notifications.length} unread notifications</span>
            {notifications.length > 0 && (
              <button onClick={handleMarkAllRead} className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer bg-orange-600 hover:bg-orange-500 transition-colors min-h-9">
                Mark All Read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
              <p className="text-green-400/60 text-sm flex items-center justify-center gap-1.5">
                <Icon name="Check" size={14} color="#2e7d32" /> No unread alert notifications
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n._id} className="bg-white/5 border border-white/5 rounded-2xl p-3.5 flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2 items-center mb-1 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase ${severityBadgeClass(n.severity)}`}>{n.severity}</span>
                      <strong className="text-sm text-white">{METRIC_LABELS[n.alert_type] || n.alert_type}</strong>
                    </div>
                    <p className="text-xs text-white/50 mb-1">{n.message}</p>
                    <span className="text-3xs text-white/30" suppressHydrationWarning>{formatDate(n.created_at)} {formatTime(n.created_at)}</span>
                  </div>
                  <button
                    onClick={() => handleDismiss(n._id)}
                    className="px-3 py-1 rounded-md text-3xs text-white/50 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer min-h-8 shrink-0"
                  >
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
          <div className="mb-3 text-sm text-white/40 flex items-center gap-3 flex-wrap">
            <span>{historyTotal} total records &middot; Page {historyPage} of {Math.ceil(historyTotal / 20) || 1}</span>
            {historyPage > 1 && (
              <button onClick={() => setHistoryPage((p) => p - 1)} className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 cursor-pointer min-h-8">
                Prev
              </button>
            )}
            {historyTotal > historyPage * 20 && (
              <button onClick={() => setHistoryPage((p) => p + 1)} className="px-2.5 py-1 rounded-md text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 cursor-pointer min-h-8">
                Next
              </button>
            )}
          </div>

          {/* Mobile: card stack */}
          <div className="lg:hidden space-y-2">
            {history.map((h) => (
              <div key={h._id} className="bg-white/5 border border-white/5 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase ${severityBadgeClass(h.severity)}`}>{h.severity}</span>
                  <strong className="text-sm text-white">{METRIC_LABELS[h.metric] || h.metric}</strong>
                </div>
                <div className="text-xs text-white/40 mb-1">
                  {h.operator} {h.threshold} (got <code className="text-white/60">{h.value}</code>)
                </div>
                <div className="text-3xs text-white/30 mb-2" suppressHydrationWarning>{formatDate(h.triggered_at)} {formatTime(h.triggered_at)}</div>
                <div className="text-xs">
                  {h.resolved_at ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <Icon name="Check" size={12} color="#2e7d32" /> Resolved <span suppressHydrationWarning>{formatDate(h.resolved_at)} {formatTime(h.resolved_at)}</span>
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1">
                      <Icon name="Circle" size={12} color="#d32f2f" fill="#d32f2f" /> Unresolved
                    </span>
                  )}
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-10 text-center">
                <p className="text-white/40 text-sm">No alert history yet</p>
              </div>
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full border-collapse text-sm2">
              <thead>
                <tr className="border-b-2 border-white/10 text-left text-white/40">
                  <th className="p-2.5">Metric</th>
                  <th className="p-2.5">Value</th>
                  <th className="p-2.5">Triggered</th>
                  <th className="p-2.5">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h._id} className="border-b border-white/5">
                    <td className="p-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold uppercase mr-1.5 ${severityBadgeClass(h.severity)}`}>{h.severity}</span>
                      <strong className="text-white">{METRIC_LABELS[h.metric] || h.metric}</strong>
                      <div className="text-3xs text-white/30">{h.operator} {h.threshold} (got {h.value})</div>
                    </td>
                    <td className="p-2.5"><code className="text-white/60">{h.value}</code></td>
                    <td className="p-2.5 text-white/40" suppressHydrationWarning>{formatDate(h.triggered_at)} {formatTime(h.triggered_at)}</td>
                    <td className="p-2.5">
                      {h.resolved_at ? (
                        <span className="text-green-400 text-xs flex items-center gap-1">
                          <Icon name="Check" size={12} color="#2e7d32" /> <span suppressHydrationWarning>{formatDate(h.resolved_at)} {formatTime(h.resolved_at)}</span>
                        </span>
                      ) : (
                        <span className="text-red-400 text-xs flex items-center gap-1">
                          <Icon name="Circle" size={12} color="#d32f2f" fill="#d32f2f" /> Unresolved
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-white/40">No alert history yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
