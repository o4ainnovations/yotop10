'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface AuditEntry {
  _id: string;
  action: string;
  ip: string;
  metadata: Record<string, unknown>;
  admin_id: string | null;
  created_at: string;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });
  const [filterAction, setFilterAction] = useState('');

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (filterAction) params.set('action', filterAction);
      const data = await apiFetch<{ logs: AuditEntry[]; pagination: { total: number; pages: number } }>(
        `/admin/audit-logs?${params}`
      );
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch { /* auth guard redirects */ }
    finally { setLoading(false); }
  }, [filterAction]);

  useEffect(() => { fetchLogs(page); }, [page, filterAction, fetchLogs]);

  const badgeStyle = (action: string) => {
    if (action === 'login_success') return { bg: '#e8f5e9', color: '#2e7d32', label: 'Login Success' };
    if (action === 'login_failed') return { bg: '#ffebee', color: '#c62828', label: 'Login Failed' };
    if (action === 'logout') return { bg: '#e3f2fd', color: '#1565c0', label: 'Logout' };
    return { bg: '#f5f5f5', color: '#616161', label: action };
  };

  return (
    <div>
      <h2>Audit Logs</h2>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          style={{ padding: '8px' }}>
          <option value="">All Actions</option>
          <option value="login_success">Login Success</option>
          <option value="login_failed">Login Failed</option>
          <option value="logout">Logout</option>
        </select>
      </div>

      {loading ? <p>Loading...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Time</th>
              <th style={{ padding: '8px' }}>Action</th>
              <th style={{ padding: '8px' }}>Username</th>
              <th style={{ padding: '8px' }}>IP</th>
              <th style={{ padding: '8px' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const badge = badgeStyle(log.action);
              return (
                <tr key={log._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontSize: '13px' }}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      backgroundColor: badge.bg, color: badge.color, padding: '2px 8px',
                      borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                    }}>{badge.label}</span>
                  </td>
                  <td style={{ padding: '8px', fontSize: '13px' }}>
                    {(log.metadata as Record<string, string>)?.username ||
                     (log.metadata as Record<string, string>)?.username_attempted || '—'}
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>{log.ip}</td>
                  <td style={{ padding: '8px', fontSize: '12px', color: '#999' }}>
                    {(log.metadata as Record<string, string>)?.stage || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {pagination.pages > 1 && (
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
          <span>Page {page} of {pagination.pages} ({pagination.total} total)</span>
          <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}>Next</button>
        </div>
      )}

      <p style={{ marginTop: '20px', fontSize: '12px', color: '#999' }}>Logs retained for 90 days. Read-only.</p>
    </div>
  );
}
