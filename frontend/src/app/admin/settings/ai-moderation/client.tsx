'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';

export default function AiModerationClient() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState(false);
  const [model, setModel] = useState('deepseek-chat');
  const [threshold, setThreshold] = useState(80);
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState<{ posts_reviewed: number; auto_approved: number; avg_score: number; total_tokens: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiFetch<{ model?: string; auto_approve_threshold?: number; enabled?: boolean; has_key?: boolean }>('/admin/settings/ai-moderation').then(d => {
      setModel(d.model || 'deepseek-chat');
      setThreshold(d.auto_approve_threshold ?? 80);
      setEnabled(d.enabled ?? false);
      setSavedKey(d.has_key ?? false);
    }).catch(() => {});
    apiFetch<{ posts_reviewed: number; auto_approved: number; avg_score: number; total_tokens: number }>('/admin/stats/ai-moderation').then(setStats).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { model, auto_approve_threshold: threshold, enabled };
      if (apiKey) body.api_key = apiKey;
      await apiFetch('/admin/settings/ai-moderation', { method: 'POST', body: JSON.stringify(body) });
      setSavedKey(true);
      setApiKey('');
      setMessage({ type: 'success', text: 'Settings saved.' });
    } catch { setMessage({ type: 'error', text: 'Failed to save settings.' }); }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {};
      if (apiKey) body.api_key = apiKey;
      if (model) body.model = model;
      await apiFetch('/admin/settings/ai-moderation/test', { method: 'POST', body: JSON.stringify(body) });
      setMessage({ type: 'success', text: 'API connection successful!' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Test failed';
      setMessage({ type: 'error', text: msg });
    }
    setTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">AI Moderation Settings</h1>

      {message && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-6">
        {/* API Configuration */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">API Configuration</h2>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">DeepSeek API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={savedKey ? 'Saved — enter new to replace' : 'sk-...'}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
              />
              {savedKey && <span className="inline-flex items-center text-2xs text-green-400"><Icon name="Check" size={14} /> Saved</span>}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Model</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Auto-Approve Threshold: <span className="text-orange-400 font-bold">{threshold}</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={threshold}
              onChange={e => setThreshold(parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-3xs text-zinc-600 mt-1">
              <span>0</span>
              <span>Any post with AI score &ge; {threshold} is auto-approved</span>
              <span>100</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-medium text-zinc-400">Enabled</label>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-orange-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            <button onClick={handleTest} disabled={testing}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/10 disabled:opacity-50">
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Stats</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">{stats.posts_reviewed}</p>
                <p className="text-2xs text-zinc-500">Reviewed</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-green-400">{stats.auto_approved}</p>
                <p className="text-2xs text-zinc-500">Auto-Approved</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">{stats.avg_score}</p>
                <p className="text-2xs text-zinc-500">Avg Score</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-lg font-bold font-mono text-white">~${(stats.total_tokens * 0.14 / 1000000).toFixed(4)}</p>
                <p className="text-2xs text-zinc-500">API Cost</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
