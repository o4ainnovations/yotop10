'use client';

import { Icon } from './icons/Icon';

export interface ConfigImpact {
  total_affected: number;
  tier_changes: {
    to_scholar: number;
    to_neutral: number;
    to_troll: number;
  };
  rate_changes: {
    increased: number;
    decreased: number;
  };
}

interface ImpactPreviewProps {
  impact: ConfigImpact | null;
  loading: boolean;
}

function hasTierChanges(impact: ConfigImpact): boolean {
  return (
    impact.tier_changes.to_scholar > 0 ||
    impact.tier_changes.to_neutral > 0 ||
    impact.tier_changes.to_troll > 0
  );
}

function hasRateChanges(impact: ConfigImpact): boolean {
  return impact.rate_changes.increased > 0 || impact.rate_changes.decreased > 0;
}

export function ImpactPreview({ impact, loading }: ImpactPreviewProps) {
  if (loading) {
    return (
      <div className="text-sm text-zinc-500 animate-pulse">
        Calculating impact...
      </div>
    );
  }

  if (!impact) {
    return null;
  }

  return (
    <div className="rounded-xl border border-orange-500/30 bg-white/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-orange-400">
        <Icon name="TriangleAlert" size={16} />
        <span className="text-sm font-medium">
          This change will affect {impact.total_affected.toLocaleString()} user{impact.total_affected !== 1 ? 's' : ''}
        </span>
      </div>

      {hasTierChanges(impact) && (
        <div className="space-y-1 text-sm text-zinc-300">
          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            Tier Changes
          </div>
          {impact.tier_changes.to_scholar > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Icon name="ArrowUp" size={12} className="text-green-400" />
              <span>{impact.tier_changes.to_scholar} user{impact.tier_changes.to_scholar !== 1 ? 's' : ''}</span>
              <span className="text-green-400">Scholar</span>
            </div>
          )}
          {impact.tier_changes.to_neutral > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Icon name="Minus" size={12} className="text-zinc-400" />
              <span>{impact.tier_changes.to_neutral} user{impact.tier_changes.to_neutral !== 1 ? 's' : ''}</span>
              <span className="text-zinc-400">Neutral</span>
            </div>
          )}
          {impact.tier_changes.to_troll > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Icon name="ArrowDown" size={12} className="text-red-400" />
              <span>{impact.tier_changes.to_troll} user{impact.tier_changes.to_troll !== 1 ? 's' : ''}</span>
              <span className="text-red-400">Troll</span>
            </div>
          )}
        </div>
      )}

      {hasRateChanges(impact) && (
        <div className="space-y-1 text-sm text-zinc-300">
          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide">
            Rate Limit Changes
          </div>
          {impact.rate_changes.increased > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Icon name="ArrowUp" size={12} className="text-green-400" />
              <span>
                {impact.rate_changes.increased} user{impact.rate_changes.increased !== 1 ? 's' : ''} get increased limits
              </span>
            </div>
          )}
          {impact.rate_changes.decreased > 0 && (
            <div className="flex items-center gap-2 pl-2">
              <Icon name="ArrowDown" size={12} className="text-red-400" />
              <span>
                {impact.rate_changes.decreased} user{impact.rate_changes.decreased !== 1 ? 's' : ''} get decreased limits
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
