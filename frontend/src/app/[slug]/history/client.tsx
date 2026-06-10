'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { API, PostHistoryResponse } from '@/lib/api';
import { formatDate } from '@/lib/dates';
import { RESERVED_ROUTES } from '@/lib/reservedRoutes';

interface PostVersion {
  version_number: number;
  title: string;
  intro: string;
  items: Array<{ rank: number; title: string; justification: string }>;
  created_at: string;
  author_username: string;
  change_summary?: string;
}

export default function PostHistoryClient({ slug }: { slug: string }) {
  const postId = slug;

  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<PostVersion | null>(null);

  if (RESERVED_ROUTES.has(postId)) notFound();

  useEffect(() => {
    if (!postId) return;
    API.getPostHistory(postId)
      .then((data: PostHistoryResponse) => {
        setVersions(data.versions || []);
        if (data.versions && data.versions.length > 0) setSelectedVersion(data.versions[0]);
      })
      .catch(() => setError('Failed to load history'))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-sm text-zinc-500">Loading history...</div>;
  if (error) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-sm text-red-400">{error}</div>;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6">
        <Link href={`/${postId}`} className="text-sm text-orange-400 hover:text-orange-300 transition">
          &larr; Back to Post
        </Link>
      </nav>

      <h1 className="text-xl font-bold text-white mb-6 sm:text-2xl">Post History / Changelog</h1>

      {versions.length === 0 ? (
        <p className="text-sm text-zinc-500 py-10 text-center">No history available.</p>
      ) : (
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Version list */}
          <div className="sm:w-1/3 space-y-2">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Versions</h2>
            {versions.map(v => (
              <button
                key={v.version_number}
                onClick={() => setSelectedVersion(v)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                  selectedVersion?.version_number === v.version_number
                    ? 'border-orange-500/30 bg-orange-500/10'
                    : 'border-white/5 bg-white/[0.03] hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-white">v{v.version_number}</span>
                  {versions[0]?.version_number === v.version_number && (
                    <span className="text-2xs text-orange-400">Current</span>
                  )}
                </div>
                <p className="text-2xs text-zinc-600" suppressHydrationWarning>{formatDate(v.created_at)}</p>
                {v.change_summary && <p className="text-2xs text-zinc-500 mt-1 line-clamp-1">{v.change_summary}</p>}
              </button>
            ))}
          </div>

          {/* Version detail */}
          <div className="sm:w-2/3">
            {selectedVersion ? (
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white">Version {selectedVersion.version_number}</h2>
                </div>
                <p className="text-2xs text-zinc-600 mb-4" suppressHydrationWarning>
                  By {selectedVersion.author_username} &middot; {formatDate(selectedVersion.created_at)}
                </p>
                {selectedVersion.change_summary && (
                  <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-sm text-orange-400 mb-4">
                    <strong>Change:</strong> {selectedVersion.change_summary}
                  </div>
                )}
                <h3 className="text-base font-bold text-white mb-1">{selectedVersion.title}</h3>
                <p className="text-sm text-zinc-400 mb-4">{selectedVersion.intro}</p>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">List Items</h4>
                <div className="space-y-2">
                  {selectedVersion.items.map(item => (
                    <div key={item.rank} className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                      <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md bg-orange-500/10 text-2xs font-bold font-mono text-orange-400">
                        {item.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white">{item.title}</p>
                        <p className="text-2xs text-zinc-500 mt-0.5">{item.justification}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500 py-10 text-center">Select a version to view details.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
