'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from './icons/Icon';

export function FingerprintMergeDetector() {
  const [mergeToken, setMergeToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'confirming' | 'confirmed' | 'expired' | 'error'>('idle');

  useEffect(() => {
    // Check for merge token header from the fingerprint middleware
    // The middleware sets x-merge-token on the response when a cross-browser match is found
    const checkMergeToken = async () => {
      try {
        // Make a lightweight request to check if there's a pending merge
        const response = await fetch('/api/fingerprint/merge-status', {
          credentials: 'include',
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data.pending && !data.confirmed) {
          // Extract token from the current page's response headers
          // The token was set by the fingerprint middleware on the initial page load
          const token = await getMergeTokenFromStorage();
          if (token) {
            setMergeToken(token);
            setStatus('idle');
          }
        }
      } catch {
        // Silently fail — merge detection is non-critical
      }
    };

    // Also check response headers on the current page
    checkMergeToken();
  }, []);

  const getMergeTokenFromStorage = useCallback(async (): Promise<string | null> => {
    // The fingerprint middleware sets x-merge-token header on responses.
    // We store it in sessionStorage when detected.
    try {
      return sessionStorage.getItem('yotop10_merge_token');
    } catch {
      return null;
    }
  }, []);

  const handleConfirm = async () => {
    if (!mergeToken) return;
    setStatus('confirming');
    try {
      const response = await fetch('/api/fingerprint/confirm-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mergeToken }),
        credentials: 'include',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed' }));
        setStatus(data.error?.includes('expired') ? 'expired' : 'error');
        return;
      }
      setStatus('confirmed');
      try { sessionStorage.removeItem('yotop10_merge_token'); } catch {}
      // Reload the page to pick up the merged identity
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setStatus('error');
    }
  };

  const handleDismiss = () => {
    setMergeToken(null);
    try { sessionStorage.removeItem('yotop10_merge_token'); } catch {}
  };

  if (!mergeToken || status === 'confirmed') return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-96">
      <div className="rounded-xl border border-orange-500/20 bg-zinc-900/95 backdrop-blur-xl px-4 py-3 shadow-lg shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20">
            <Icon name="Link" size={18} className="text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">
              Link this device?
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              A device with your identity was detected. Link to sync your profile and reputation.
            </p>
            {status === 'error' && (
              <p className="text-xs text-red-400 mt-1">Failed to link. The request may have expired.</p>
            )}
            {status === 'expired' && (
              <p className="text-xs text-amber-400 mt-1">Link expired. Please revisit from your original device.</p>
            )}
          </div>
          {status === 'idle' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleConfirm}
                className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:scale-105 active:scale-95"
              >
                Link
              </button>
              <button
                onClick={handleDismiss}
                className="text-zinc-500 hover:text-zinc-400 transition"
                aria-label="Dismiss"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          )}
          {status === 'confirming' && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-5 h-5 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
