import { describe, it, expect } from 'vitest';
import { normalizeTitle, isYearVariation } from '../lib/titleNormalization';

describe('Title normalization', () => {
  describe('normalizeTitle', () => {
    it('lowercases and removes special chars', () => {
      const result = normalizeTitle('Top 10 Movies!');
      expect(result.normalized).toBe('top 10 movy');
    });

    it('removes common filler words when enough words remain', () => {
      const result = normalizeTitle('The Best of the Best Movies');
      expect(result.normalized).not.toContain('the');
    });

    it('preserves words ending in ss', () => {
      const result = normalizeTitle('Top 10 Business Leaders');
      expect(result.normalized).toContain('busines');
    });

    it('detects year suffix', () => {
      const result = normalizeTitle('Top 10 Movies 2024');
      expect(result.hasYearSuffix).toBe(true);
      expect(result.year).toBe(2024);
    });

    it('converts consonant+ies to y (cities → city)', () => {
      const result = normalizeTitle('Top 10 Cities');
      expect(result.normalized).toContain('city');
    });

    it('handles regular plurals', () => {
      const result = normalizeTitle('Top 10 Dramas');
      expect(result.normalized).toContain('drama');
    });
  });

  describe('isYearVariation', () => {
    it('detects year-only difference', () => {
      const a = normalizeTitle('Top 10 Movies 2024');
      const b = normalizeTitle('Top 10 Movies 2025');
      expect(isYearVariation(a, b)).toBe(true);
    });

    it('rejects non-year differences', () => {
      const a = normalizeTitle('Top 10 Movies 2024');
      const b = normalizeTitle('Top 10 Shows 2024');
      expect(isYearVariation(a, b)).toBe(false);
    });
  });
});
