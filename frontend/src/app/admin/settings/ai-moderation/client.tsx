'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Icon } from '@/components/icons/Icon';

const PREDEFINED_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-chat-v4-flash',
  'deepseek-pro',
  '__custom__',
];

export default function AiModerationClient() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState(false);
  const [model, setModel] = useState('deepseek-chat');
  const [customModel, setCustomModel] = useState('');
  const [modelSelect, setModelSelect] = useState('deepseek-chat');
  const [temperature, setTemperature] = useState(0.1);
  const [threshold, setThreshold] = useState(80);
  const [enabled, setEnabled] = useState(false);
  const [stats, setStats] = useState<{ posts_reviewed: number; auto_approved: number; avg_score: number; total_tokens: number } | null>(null);
  const [availablePosts, setAvailablePosts] = useState<Array<{ slug: string; title: string }>>([]);
  const [testPostSlug, setTestPostSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ score: number; flags: string[]; model: string; tokens: number; sample?: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    apiFetch<{ model?: string; temperature?: number; auto_approve_threshold?: number; enabled?: boolean; has_key?: boolean }>('/admin/settings/ai-moderation').then(d => {
      const m = d.model || 'deepseek-chat';
      if (PREDEFINED_MODELS.includes(m)) {
        setModelSelect(m);
        setModel(m);
      } else {
        setModelSelect('__custom__');
        setCustomModel(m);
        setModel(m);
      }
      setTemperature(d.temperature ?? 0.1);
      setThreshold(d.auto_approve_threshold ?? 80);
      setEnabled(d.enabled ?? false);
      setSavedKey(d.has_key ?? false);
    }).catch(() => {});
    apiFetch<{ posts_reviewed: number; auto_approved: number; avg_score: number; total_tokens: number }>('/admin/stats/ai-moderation').then(setStats).catch(() => {});
    apiFetch<{ posts: Array<{ slug: string; title: string }> }>('/admin/posts?limit=50&status=approved').then(d => setAvailablePosts(d.posts || [])).catch(() => {});
  }, []);

  const handleModelChange = (val: string) => {
    setModelSelect(val);
    if (val === '__custom__') {
      setModel(customModel || 'deepseek-chat');
    } else {
      setModel(val);
    }
  };

  const handleCustomModelChange = (val: string) => {
    setCustomModel(val);
    setModel(val);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { model, temperature, auto_approve_threshold: threshold, enabled };
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
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {};
      if (apiKey) body.api_key = apiKey;
      body.model = model;
      body.temperature = temperature;
      if (testPostSlug) body.slug = testPostSlug;
      const res = await apiFetch<{ success: boolean; score: number; flags: string[]; model: string; tokens: number; title: string }>('/admin/settings/ai-moderation/test', { method: 'POST', body: JSON.stringify(body) });
      setTestResult({ score: res.score, flags: res.flags, model: res.model, tokens: res.tokens, sample: res.title || '' });
      setMessage({ type: 'success', text: `AI scored it ${res.score}/100 — Model: ${res.model}` });
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
            <div className="flex gap-2">
              <select
                value={modelSelect}
                onChange={e => handleModelChange(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none"
              >
                <option value="deepseek-chat" className="bg-zinc-900">DeepSeek Chat (latest)</option>
                <option value="deepseek-reasoner" className="bg-zinc-900">DeepSeek Reasoner</option>
                <option value="deepseek-chat-v4-flash" className="bg-zinc-900">DeepSeek V4 Flash</option>
                <option value="deepseek-pro" className="bg-zinc-900">DeepSeek Pro</option>
                <option value="__custom__" className="bg-zinc-900">Custom...</option>
              </select>
              {modelSelect === '__custom__' && (
                <input
                  type="text"
                  value={customModel}
                  onChange={e => handleCustomModelChange(e.target.value)}
                  placeholder="Enter model name"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none"
                />
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Temperature: <span className="text-orange-400 font-bold">{temperature.toFixed(1)}</span>
            </label>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={Math.round(temperature * 10)}
              onChange={e => setTemperature(parseInt(e.target.value) / 10)}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-3xs text-zinc-600 mt-1">
              <span>0 (deterministic)</span>
              <span>Lower = consistent scoring</span>
              <span>2.0 (creative)</span>
            </div>
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
              <span>Score &ge; {threshold} auto-approved</span>
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

          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Test Post (optional)</label>
            <select value={testPostSlug} onChange={e => setTestPostSlug(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-orange-500/50 focus:outline-none">
              <option value="" className="bg-zinc-900">Use hardcoded sample post</option>
              {availablePosts.map(p => (
                <option key={p.slug} value={p.slug} className="bg-zinc-900">{p.title}</option>
              ))}
            </select>
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

          {/* Test result */}
          {testResult && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Test Analysis Result</h3>
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold font-mono ${
                  testResult.score >= 80 ? 'bg-green-500/15 text-green-400' :
                  testResult.score >= 40 ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-red-500/15 text-red-400'
                }`}>
                  {testResult.score}/100
                </span>
                <span className="text-2xs text-zinc-500">Model: <span className="font-mono text-zinc-400">{testResult.model}</span></span>
                <span className="text-2xs text-zinc-500">{testResult.tokens} tokens used</span>
              </div>
              {testResult.flags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {testResult.flags.map(f => (
                    <span key={f} className="rounded-full bg-yellow-500/10 text-yellow-400 px-2 py-0.5 text-2xs font-medium">{f}</span>
                  ))}
                </div>
              )}
              {testResult.flags.length === 0 && (
                <p className="text-xs text-green-400">No quality issues detected.</p>
              )}
              <p className="text-2xs text-zinc-600 mt-2">Post: &ldquo;{testResult.sample || 'Sample post'}&rdquo;</p>
            </div>
          )}
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
