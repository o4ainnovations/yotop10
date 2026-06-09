'use client';

import { useState, useCallback, useRef } from 'react';
import { API } from '@/lib/api';
import type { TitleCheckResponse } from '@/lib/api/types';

interface TitleMatch {
  title: string;
  slug: string;
  category_slug: string;
  similarity: number;
}

const DEBOUNCE_MS = 500;

export function useTitleCheck() {
  const [titleStatus, setTitleStatus] = useState<{
    checking: boolean;
    blocked: boolean;
    warning: boolean;
    matches: TitleMatch[];
  }>({ checking: false, blocked: false, warning: false, matches: [] });
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkTitle = useCallback((titleValue: string) => {
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    if (!titleValue || titleValue.length < 3) {
      setTitleStatus({ checking: false, blocked: false, warning: false, matches: [] });
      return;
    }
    setTitleStatus(prev => ({ ...prev, checking: true }));

    checkTimerRef.current = setTimeout(async () => {
      try {
        const data = await API.checkTitle(titleValue, '') as TitleCheckResponse;
        setTitleStatus({
          checking: false,
          blocked: data.blocked || false,
          warning: data.warning || false,
          matches: (data.matches || []).slice(0, 5),
        });
      } catch {
        setTitleStatus({ checking: false, blocked: false, warning: false, matches: [] });
      }
    }, DEBOUNCE_MS);
  }, []);

  return { titleStatus, checkTitle };
}
