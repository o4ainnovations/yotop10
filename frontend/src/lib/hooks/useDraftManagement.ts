'use client';

import { useCallback, useEffect, useRef } from 'react';

interface DraftData {
  category_slug?: string;
  title?: string;
  intro?: string;
  format?: string;
  hero_image_url?: string;
  items?: Array<{ title: string; justification: string; source_url: string; image_url: string }>;
  author_display_name?: string;
  savedAt: number;
}

const DRAFT_KEY = 'yotop10_submit_draft';
const DRAFT_EXPIRY_MS = 3600000;

export function useDraftManagement(formDataRef: React.MutableRefObject<DraftData | null>) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveDraft = useCallback(() => {
    if (!formDataRef.current) return;
    const data = { ...formDataRef.current, savedAt: Date.now() };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch {}
  }, [formDataRef]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 2000);
  }, [saveDraft]);

  const flushDraftSync = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveDraft();
  }, [saveDraft]);

  const loadDraft = useCallback((): DraftData | null => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as DraftData;
      if (Date.now() - data.savedAt > DRAFT_EXPIRY_MS) {
        localStorage.removeItem(DRAFT_KEY);
        return null;
      }
      return data;
    } catch { return null; }
  }, []);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }, []);

  // Flush draft on page unload
  useEffect(() => {
    window.addEventListener('beforeunload', flushDraftSync);
    return () => window.removeEventListener('beforeunload', flushDraftSync);
  }, [flushDraftSync]);

  return { debouncedSave, loadDraft, clearDraft, flushDraftSync };
}
