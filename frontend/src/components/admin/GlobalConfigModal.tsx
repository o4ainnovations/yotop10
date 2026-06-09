'use client';

import { useState, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import type { SystemConfig, ConfigImpact } from '@/lib/api/types';

interface GlobalConfigModalProps {
  config: SystemConfig | null;
  onClose: () => void;
  onSave: (config: SystemConfig) => Promise<void>;
  onPreviewImpact: (config: SystemConfig) => Promise<ConfigImpact | null>;
}

function tierEffectiveRates(config: SystemConfig) {
  const bp = config.rate_limits.base_posts_per_hour;
  const bc = config.rate_limits.base_comments_per_hour;
  return {
    troll: { posts: Math.round(bp * config.rate_limits.troll_multiplier), comments: Math.round(bc * config.rate_limits.troll_multiplier) },
    neutral: { posts: Math.round(bp * config.rate_limits.neutral_multiplier), comments: Math.round(bc * config.rate_limits.neutral_multiplier) },
    scholar: { posts: Math.round(bp * config.rate_limits.scholar_multiplier), comments: Math.round(bc * config.rate_limits.scholar_multiplier) },
  };
}

export function GlobalConfigModal({ config, onClose, onSave, onPreviewImpact }: GlobalConfigModalProps) {
  const [tab, setTab] = useState<'rate' | 'trust'>('rate');
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState<ConfigImpact | null>(null);

  const [basePosts, setBasePosts] = useState(config?.rate_limits?.base_posts_per_hour ?? 10);
  const [baseComments, setBaseComments] = useState(config?.rate_limits?.base_comments_per_hour ?? 30);
  const [counterToggle, setCounterToggle] = useState(config?.rate_limits?.counter_lists_toggle ?? false);
  const [editWindow, setEditWindow] = useState(config?.rate_limits?.comment_edit_window_minutes ?? 5);

  const [scholarThreshold, setScholarThreshold] = useState(config?.trust_tiers?.scholar_threshold ?? 1.5);
  const [trollThreshold, setTrollThreshold] = useState(config?.trust_tiers?.troll_threshold ?? 0.5);
  const [reviewWindow, setReviewWindow] = useState(config?.trust_tiers?.review_window_hours ?? 24);
  const [doubleBlind, setDoubleBlind] = useState(config?.trust_tiers?.double_blind ?? true);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const buildConfig = (): SystemConfig => ({
    rate_limits: {
      base_posts_per_hour: basePosts,
      base_comments_per_hour: baseComments,
      troll_multiplier: config?.rate_limits?.troll_multiplier ?? 0.25,
      neutral_multiplier: config?.rate_limits?.neutral_multiplier ?? 1,
      scholar_multiplier: config?.rate_limits?.scholar_multiplier ?? 2,
      counter_lists_toggle: counterToggle,
      comment_edit_window_minutes: editWindow,
    },
    trust_tiers: {
      scholar_threshold: scholarThreshold,
      troll_threshold: trollThreshold,
      hysteresis: Math.round((scholarThreshold - trollThreshold) * 0.1 * 100) / 100,
      review_window_hours: reviewWindow,
      double_blind: doubleBlind,
    },
  });

  const handlePreview = async () => {
    const result = await onPreviewImpact(buildConfig());
    if (result) setImpact(result);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(buildConfig());
    setSaving(false);
    onClose();
  };

  const rates = tierEffectiveRates(buildConfig());
  const hysteresis = Math.round((scholarThreshold - trollThreshold) * 0.1 * 100) / 100;

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono';
  const labelClass = 'text-zinc-500 text-xs uppercase tracking-wider block mb-1.5';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-lg">Global Configuration</h3>
          <button aria-label="Close" onClick={onClose} className="text-zinc-500 hover:text-white cursor-pointer">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="flex gap-1 mb-5 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setTab('rate')}
            className={`flex-1 py-2 text-sm rounded-md cursor-pointer transition-colors ${tab === 'rate' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-500 hover:text-white'}`}
          >
            Rate Limits
          </button>
          <button
            onClick={() => setTab('trust')}
            className={`flex-1 py-2 text-sm rounded-md cursor-pointer transition-colors ${tab === 'trust' ? 'bg-white/10 text-white font-semibold' : 'text-zinc-500 hover:text-white'}`}
          >
            Trust Tiers
          </button>
        </div>

        {tab === 'rate' && (
          <div>
            <div className="mb-4">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Base Posts/Hour</span>
                <span className="text-white font-mono">{basePosts}</span>
              </label>
              <div className="flex gap-3 items-center">
                <input type="range" min={0} max={50} value={basePosts} onChange={e => setBasePosts(parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                <input type="number" min={0} max={50} value={basePosts} onChange={e => setBasePosts(parseInt(e.target.value) || 0)} className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none font-mono text-center" />
              </div>
            </div>

            <div className="mb-4">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Base Comments/Hour</span>
                <span className="text-white font-mono">{baseComments}</span>
              </label>
              <div className="flex gap-3 items-center">
                <input type="range" min={0} max={120} value={baseComments} onChange={e => setBaseComments(parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                <input type="number" min={0} max={120} value={baseComments} onChange={e => setBaseComments(parseInt(e.target.value) || 0)} className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none font-mono text-center" />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
              <h4 className="text-white/60 text-xs uppercase tracking-wider mb-2 font-semibold">Tier Effective Rates</h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  <span className="text-red-400 text-2xs uppercase tracking-wider font-semibold block mb-0.5">Troll</span>
                  <span className="text-white font-mono text-xs">{rates.troll.posts}p / {rates.troll.comments}c</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                  <span className="text-zinc-500 text-2xs uppercase tracking-wider font-semibold block mb-0.5">Neutral</span>
                  <span className="text-white font-mono text-xs">{rates.neutral.posts}p / {rates.neutral.comments}c</span>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-2">
                  <span className="text-green-400 text-2xs uppercase tracking-wider font-semibold block mb-0.5">Scholar</span>
                  <span className="text-white font-mono text-xs">{rates.scholar.posts}p / {rates.scholar.comments}c</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={counterToggle} onChange={e => setCounterToggle(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-orange-500" />
                <span className="text-white text-sm">Counter lists toggle</span>
              </label>
            </div>

            <div className="mb-5">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Comment Edit Window (min)</span>
                <span className="text-white font-mono">{editWindow}</span>
              </label>
              <input type="number" min={0} max={1440} value={editWindow} onChange={e => setEditWindow(parseInt(e.target.value) || 0)} className={inputClass} />
            </div>
          </div>
        )}

        {tab === 'trust' && (
          <div>
            <div className="mb-4">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Scholar Threshold</span>
                <span className="text-white font-mono">{scholarThreshold.toFixed(2)}</span>
              </label>
              <div className="flex gap-3 items-center">
                <input type="range" min={1.0} max={2.0} step={0.01} value={scholarThreshold} onChange={e => setScholarThreshold(parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                <input type="number" min={1.0} max={2.0} step={0.01} value={scholarThreshold} onChange={e => setScholarThreshold(parseFloat(e.target.value) || 1.0)} className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none font-mono text-center" />
              </div>
            </div>

            <div className="mb-4">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Troll Threshold</span>
                <span className="text-white font-mono">{trollThreshold.toFixed(2)}</span>
              </label>
              <div className="flex gap-3 items-center">
                <input type="range" min={0.1} max={1.0} step={0.01} value={trollThreshold} onChange={e => setTrollThreshold(parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:cursor-pointer" />
                <input type="number" min={0.1} max={1.0} step={0.01} value={trollThreshold} onChange={e => setTrollThreshold(parseFloat(e.target.value) || 0.1)} className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none font-mono text-center" />
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
              <span className="text-zinc-500 text-xs">Hysteresis:</span>
              <span className="ml-2 text-white font-mono text-sm">{hysteresis.toFixed(2)}</span>
              <p className="text-zinc-600 text-3xs mt-1">
                Buffer zone to prevent rapid tier oscillation
              </p>
            </div>

            <div className="mb-4">
              <label className={`${labelClass} flex items-center justify-between`}>
                <span>Review Window (hours)</span>
                <span className="text-white font-mono">{reviewWindow}</span>
              </label>
              <input type="number" min={1} max={720} value={reviewWindow} onChange={e => setReviewWindow(parseInt(e.target.value) || 1)} className={inputClass} />
            </div>

            <div className="mb-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={doubleBlind} onChange={e => setDoubleBlind(e.target.checked)} className="w-4 h-4 rounded bg-white/10 border-white/20 cursor-pointer accent-orange-500" />
                <span className="text-white text-sm">Double-blind review</span>
              </label>
              <p className="text-zinc-600 text-3xs mt-1 ml-6">Hide author identity in review queue</p>
            </div>
          </div>
        )}

        {impact && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
            <h4 className="text-white/60 text-xs uppercase tracking-wider mb-2 font-semibold">Impact Preview</h4>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-zinc-500 text-2xs block">Affected</span>
                <span className="text-white font-mono font-bold">{impact.users_affected}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-2xs block">Tier Up</span>
                <span className="text-green-400 font-mono font-bold">{impact.tier_changes.to_scholar}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-2xs block">Tier Down</span>
                <span className="text-red-400 font-mono font-bold">{impact.tier_changes.to_troll}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div>
                <span className="text-zinc-600 text-2xs block">Rate Up</span>
                <span className="text-green-400 font-mono text-xs">{impact.rate_changes.increased}</span>
              </div>
              <div>
                <span className="text-zinc-600 text-2xs block">Rate Down</span>
                <span className="text-red-400 font-mono text-xs">{impact.rate_changes.decreased}</span>
              </div>
              <div>
                <span className="text-zinc-600 text-2xs block">Unchanged</span>
                <span className="text-white/60 font-mono text-xs">{impact.rate_changes.unchanged}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            className="px-4 py-2.5 cursor-pointer bg-white/5 border border-white/10 rounded-xl text-white/70 text-sm hover:text-white"
          >
            Preview Impact
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2.5 cursor-pointer bg-gradient-to-r from-orange-500 to-red-600 text-white border-none rounded-xl text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Config'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 cursor-pointer bg-white/5 border border-white/10 rounded-xl text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
