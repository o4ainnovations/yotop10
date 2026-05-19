'use client';

import { useState, useEffect, useCallback } from 'react';
import { Icon } from './icons/Icon';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setDismissed(true);
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:w-80">
      <div className="flex items-center gap-3 rounded-xl bg-[var(--color-bg)]/95 backdrop-blur-xl border border-white/10 px-4 py-3 shadow-lg shadow-black/40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600">
          <Icon name="Download" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            Install YoTop10
          </p>
          <p className="text-xs text-zinc-400">
            For a better experience
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstall}
            className="rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:scale-105 active:scale-95"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="text-zinc-500 hover:text-zinc-400 transition"
            aria-label="Dismiss"
          >
            <Icon name="X" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
