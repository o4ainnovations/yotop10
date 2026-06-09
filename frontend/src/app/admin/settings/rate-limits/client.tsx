'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/lib/toast';
import { Icon } from '@/components/icons/Icon';

interface TierLimit {
  tier: string;
  trust_range: string;
  post_limit: number;
  comment_limit: number;
  user_count: number;
}

interface RateAnalytics {
  total_users: number;
  users_with_overrides: number;
  tier_limits: TierLimit[];
  base_rates: { posts_per_hour: number; comments_per_hour: number };
}

interface Config {
  rate_limits: {
    base_posts_per_hour: number;
    base_comments_per_hour: number;
    tiers: Record<string, { multiplier: number; min_posts?: number }>;
    comment_edit_window_minutes: number;
    counter_lists_unlimited: boolean;
  };
  trust_tiers: {
    troll_max: number;
    neutral_min: number;
    scholar_min: number;
    hysteresis_enter: number;
    hysteresis_lose: number;
    review_window: number;
    double_blind: boolean;
  };
  version: number;
}

export default function RateLimitsClient() {
  const [analytics, setAnalytics] = useState<RateAnalytics | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState<{ users_affected: number; tier_changes: Record<string, number>; rate_changes: Record<string, number> } | null>(null);

  // Editable form state
  const [form, setForm] = useState({
    base_posts_per_hour: 4,
    base_comments_per_hour: 20,
    troll_multiplier: 0.5,
    troll_min_posts: 2,
    neutral_multiplier: 1.0,
    scholar_multiplier: 2.0,
    scholar_min: 1.8,
    troll_max: 0.49,
    hysteresis_enter: 1.85,
    hysteresis_lose: 1.70,
    comment_edit_window_minutes: 120,
    counter_lists_unlimited: true,
    review_window: 50,
    double_blind: true,
  });

  useEffect(() => {
    Promise.all([
      apiFetch<{ config: Config }>('/admin/config'),
      apiFetch<RateAnalytics>('/admin/config/rate-analytics'),
    ]).then(([c, a]) => {
      setConfig(c.config);
      setAnalytics(a);
      setForm({
        base_posts_per_hour: c.config.rate_limits.base_posts_per_hour,
        base_comments_per_hour: c.config.rate_limits.base_comments_per_hour,
        troll_multiplier: c.config.rate_limits.tiers.troll?.multiplier || 0.5,
        troll_min_posts: c.config.rate_limits.tiers.troll?.min_posts || 2,
        neutral_multiplier: c.config.rate_limits.tiers.neutral?.multiplier || 1.0,
        scholar_multiplier: c.config.rate_limits.tiers.scholar?.multiplier || 2.0,
        scholar_min: c.config.trust_tiers.scholar_min,
        troll_max: c.config.trust_tiers.troll_max,
        hysteresis_enter: c.config.trust_tiers.hysteresis_enter,
        hysteresis_lose: c.config.trust_tiers.hysteresis_lose,
        comment_edit_window_minutes: c.config.rate_limits.comment_edit_window_minutes,
        counter_lists_unlimited: c.config.rate_limits.counter_lists_unlimited,
        review_window: c.config.trust_tiers.review_window,
        double_blind: c.config.trust_tiers.double_blind,
      });
    }).catch(() => toast.error('Failed to load configuration'))
    .finally(() => setLoading(false));
  }, []);

  const computeImpact = async () => {
    const changes = {
      rate_limits: {
        base_posts_per_hour: form.base_posts_per_hour,
        base_comments_per_hour: form.base_comments_per_hour,
        tiers: {
          troll: { multiplier: form.troll_multiplier, min_posts: form.troll_min_posts },
          neutral: { multiplier: form.neutral_multiplier },
          scholar: { multiplier: form.scholar_multiplier },
        },
      },
      trust_tiers: {
        scholar_min: form.scholar_min,
        troll_max: form.troll_max,
        hysteresis_enter: form.hysteresis_enter,
        hysteresis_lose: form.hysteresis_lose,
      },
    };
    try {
      const data = await apiFetch<{ users_affected: number; tier_changes: Record<string, number>; rate_changes: Record<string, number> }>(
        `/admin/config/impact?changes=${encodeURIComponent(JSON.stringify(changes))}`
      );
      setImpact(data);
    } catch {
      toast.error('Failed to compute impact preview');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const changes = {
        rate_limits: {
          base_posts_per_hour: form.base_posts_per_hour,
          base_comments_per_hour: form.base_comments_per_hour,
          tiers: {
            troll: { multiplier: form.troll_multiplier, min_posts: form.troll_min_posts },
            neutral: { multiplier: form.neutral_multiplier },
            scholar: { multiplier: form.scholar_multiplier },
          },
          comment_edit_window_minutes: form.comment_edit_window_minutes,
          counter_lists_unlimited: form.counter_lists_unlimited,
        },
        trust_tiers: {
          scholar_min: form.scholar_min,
          troll_max: form.troll_max,
          hysteresis_enter: form.hysteresis_enter,
          hysteresis_lose: form.hysteresis_lose,
          review_window: form.review_window,
          double_blind: form.double_blind,
        },
      };
      await apiFetch('/admin/config', { method: 'PUT', body: JSON.stringify(changes) });
      toast.success('Configuration saved');
      setImpact(null);
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse space-y-4">{Array.from({length:3}).map((_,i) => <div key={i} className="h-32 rounded-xl bg-white/5" />)}</div>;

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50";

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-xl font-bold text-white">Rate Limits & Trust Scores</h1>
        <p className="text-sm text-zinc-500 mt-1">Configure platform-wide rate limits, trust score thresholds, and view user distribution.</p>
      </div>

      {/* Panel 1: Rate Limit Analytics */}
      <section className="rounded-2xl border border-white/5 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="Eye" size={18} className="text-orange-400" />
          Rate Limit Analytics
        </h2>
        {analytics && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-2xs text-zinc-500 uppercase tracking-wider">Total Users</p>
                <p className="text-lg font-bold text-white">{analytics.total_users}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-2xs text-zinc-500 uppercase tracking-wider">Overrides</p>
                <p className="text-lg font-bold text-white">{analytics.users_with_overrides}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-2xs text-zinc-500 uppercase tracking-wider">Base Posts/h</p>
                <p className="text-lg font-bold text-white">{analytics.base_rates.posts_per_hour}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-2xs text-zinc-500 uppercase tracking-wider">Base Comments/h</p>
                <p className="text-lg font-bold text-white">{analytics.base_rates.comments_per_hour}</p>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-500 text-xs">
                  <th className="pb-2 font-medium">Tier</th>
                  <th className="pb-2 font-medium">Trust Range</th>
                  <th className="pb-2 font-medium">Posts/h</th>
                  <th className="pb-2 font-medium">Comments/h</th>
                  <th className="pb-2 font-medium">Users</th>
                </tr>
              </thead>
              <tbody>
                {analytics.tier_limits.map(t => (
                  <tr key={t.tier} className="border-b border-white/5">
                    <td className="py-2 text-white capitalize">{t.tier}</td>
                    <td className="py-2 text-zinc-400 font-mono text-xs">{t.trust_range}</td>
                    <td className="py-2 text-white font-mono">{t.post_limit}</td>
                    <td className="py-2 text-white font-mono">{t.comment_limit}</td>
                    <td className="py-2 text-white font-mono">{t.user_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Panel 2: Live Effective Limits Table */}
      <section className="rounded-2xl border border-white/5 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="Eye" size={18} className="text-orange-400" />
          Live Effective Limits — Preview
        </h2>
        {analytics && (() => {
          const tiers = [
            { name: 'Troll', trust: form.troll_max, mult: form.troll_multiplier, min: form.troll_min_posts },
            { name: 'Neutral', trust: (form.scholar_min + form.troll_max) / 2, mult: form.neutral_multiplier, min: 0 },
            { name: 'Scholar', trust: form.scholar_min, mult: form.scholar_multiplier, min: 0 },
          ];
          return (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-zinc-500 text-xs">
                  <th className="pb-2 font-medium">Tier</th>
                  <th className="pb-2 font-medium">Example Trust</th>
                  <th className="pb-2 font-medium">Multiplier</th>
                  <th className="pb-2 font-medium">Effective Posts/h</th>
                  <th className="pb-2 font-medium">Effective Comments/h</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map(t => {
                  const ep = Math.max(t.min || 0, Math.floor(form.base_posts_per_hour * t.mult));
                  const ec = Math.floor(form.base_comments_per_hour * t.mult);
                  return (
                    <tr key={t.name} className="border-b border-white/5">
                      <td className="py-2 text-white capitalize">{t.name}</td>
                      <td className="py-2 text-zinc-400 font-mono text-xs">{t.trust.toFixed(2)}</td>
                      <td className="py-2 text-white font-mono">{t.mult}x</td>
                      <td className="py-2 text-white font-mono">{ep}</td>
                      <td className="py-2 text-white font-mono">{ec}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </section>

      {/* Panel 3: Config Editor */}
      <section className="rounded-2xl border border-white/5 bg-white/5 p-5">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Icon name="Zap" size={18} className="text-orange-400" />
          Configuration Editor
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Base Posts / Hour</label>
            <input type="number" value={form.base_posts_per_hour} onChange={e => setForm(f => ({...f, base_posts_per_hour: Number(e.target.value)}))} className={inputClass} min={1} max={100} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Base Comments / Hour</label>
            <input type="number" value={form.base_comments_per_hour} onChange={e => setForm(f => ({...f, base_comments_per_hour: Number(e.target.value)}))} className={inputClass} min={1} max={500} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Edit Window (minutes)</label>
            <input type="number" value={form.comment_edit_window_minutes} onChange={e => setForm(f => ({...f, comment_edit_window_minutes: Number(e.target.value)}))} className={inputClass} min={1} max={1440} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Scholar Min Trust</label>
            <input type="number" value={form.scholar_min} onChange={e => setForm(f => ({...f, scholar_min: Number(e.target.value)}))} className={inputClass} step={0.01} min={0.1} max={2.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Troll Max Trust</label>
            <input type="number" value={form.troll_max} onChange={e => setForm(f => ({...f, troll_max: Number(e.target.value)}))} className={inputClass} step={0.01} min={0.1} max={2.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Hysteresis Enter</label>
            <input type="number" value={form.hysteresis_enter} onChange={e => setForm(f => ({...f, hysteresis_enter: Number(e.target.value)}))} className={inputClass} step={0.01} min={0.1} max={2.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Hysteresis Lose</label>
            <input type="number" value={form.hysteresis_lose} onChange={e => setForm(f => ({...f, hysteresis_lose: Number(e.target.value)}))} className={inputClass} step={0.01} min={0.1} max={2.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Troll Multiplier</label>
            <input type="number" value={form.troll_multiplier} onChange={e => setForm(f => ({...f, troll_multiplier: Number(e.target.value)}))} className={inputClass} step={0.1} min={0.1} max={5.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Troll Min Posts</label>
            <input type="number" value={form.troll_min_posts} onChange={e => setForm(f => ({...f, troll_min_posts: Number(e.target.value)}))} className={inputClass} min={0} max={20} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Neutral Multiplier</label>
            <input type="number" value={form.neutral_multiplier} onChange={e => setForm(f => ({...f, neutral_multiplier: Number(e.target.value)}))} className={inputClass} step={0.1} min={0.1} max={5.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Scholar Multiplier</label>
            <input type="number" value={form.scholar_multiplier} onChange={e => setForm(f => ({...f, scholar_multiplier: Number(e.target.value)}))} className={inputClass} step={0.1} min={0.1} max={5.0} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Review Window</label>
            <input type="number" value={form.review_window} onChange={e => setForm(f => ({...f, review_window: Number(e.target.value)}))} className={inputClass} min={1} max={500} />
          </div>
        </div>

        {/* Checkboxes */}
        <div className="mt-4 space-y-2">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.counter_lists_unlimited} onChange={e => setForm(f => ({...f, counter_lists_unlimited: e.target.checked}))} className="rounded border-white/10 bg-white/5" />
            Unlimited counter lists
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={form.double_blind} onChange={e => setForm(f => ({...f, double_blind: e.target.checked}))} className="rounded border-white/10 bg-white/5" />
            Double-blind moderation (super admin only)
          </label>
        </div>

        {/* Impact Preview */}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={computeImpact} className="rounded-lg border border-orange-500/30 px-4 py-2 text-sm text-orange-400 hover:bg-orange-500/10 transition">
            Preview Impact
          </button>
          {impact && (
            <div className="flex gap-4 text-xs text-zinc-400">
              <span>{impact.users_affected} users affected</span>
              <span className="text-emerald-400">+{impact.tier_changes?.to_scholar || 0} to scholar</span>
              <span className="text-red-400">-{impact.tier_changes?.from_scholar || 0} from scholar</span>
            </div>
          )}
        </div>

        {/* Save */}
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-xl hover:shadow-orange-500/40 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          {config && <span className="text-2xs text-zinc-600">v{config.version}</span>}
        </div>
      </section>
    </div>
  );
}
