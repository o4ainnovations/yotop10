'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { API } from '@/lib/api';

interface HistoryEntry {
  id: string;
  custom_display_name: string;
  created_at: string;
  released_at: string | null;
  previous_username: string | null;
}

export default function UsernameHistoryClient() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await API.getUsernameHistory() as { history: HistoryEntry[] };
        setHistory(data.history);
      } catch (err) {
        console.error('Failed to load username history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (loading) return <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center text-sm text-zinc-500">Loading...</div>;

  return (
    <div className="min-h-screen bg-[var(--color-bg)] mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <nav className="mb-6">
        <Link href="/a" className="text-sm text-orange-400 hover:text-orange-300 transition">
          &larr; Back to Profile
        </Link>
      </nav>

      <h1 className="text-xl font-bold text-white mb-6 sm:text-2xl">Username History</h1>

      {history.length === 0 ? (
        <p className="text-sm text-zinc-500 py-10 text-center">No username history yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm font-medium text-white truncate">{entry.custom_display_name}</p>
                <p className="text-2xs text-zinc-600 mt-0.5" suppressHydrationWarning>{new Date(entry.created_at).toLocaleString()}</p>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-2xs font-semibold ${
                entry.released_at ? 'bg-zinc-500/10 text-zinc-500' : 'bg-green-500/10 text-green-400'
              }`}>
                {entry.released_at ? 'Released' : 'Current'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
