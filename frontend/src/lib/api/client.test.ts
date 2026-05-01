import { describe, it, expect, vi } from 'vitest';
import { getBaseUrl } from '@/lib/api/client';

describe('API Client', () => {
  describe('getBaseUrl', () => {
    it('returns relative /api on client-side', () => {
      expect(getBaseUrl()).toBe('/api');
    });

    it('returns configured URL when INTERNAL_API_URL is set', () => {
      const backup = process.env.INTERNAL_API_URL;
      process.env.INTERNAL_API_URL = 'http://backend:8000/api';
      vi.stubGlobal('window', undefined);
      expect(getBaseUrl()).toBe('http://backend:8000/api');
      process.env.INTERNAL_API_URL = backup;
      vi.unstubAllGlobals();
    });
  });
});
