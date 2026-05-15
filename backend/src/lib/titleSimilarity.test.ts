import { describe, it, expect } from 'vitest';
import { checkTitleMatch } from '../lib/titleSimilarity';

describe('titleSimilarity', () => {
  describe('checkTitleMatch', () => {
    it('detects exact duplicate titles', () => {
      const result = checkTitleMatch('Top 10 Movies', 'Top 10 Movies');
      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(100);
    });

    it('detects year variation as non-duplicate', () => {
      const result = checkTitleMatch('Top 10 Movies of 2024', 'Top 10 Movies of 2025');
      expect(result.isYearVariation).toBe(true);
      expect(result.isDuplicate).toBe(false);
    });

    it('detects similar titles above block threshold (no year)', () => {
      const result = checkTitleMatch('Top 10 Best Action Movies Ever', 'Top 10 Best Action Movies Ever');
      expect(result.isDuplicate).toBe(true);
    });

    it('returns isWarning for moderately similar titles', () => {
      const result = checkTitleMatch('Top 10 Best Action Movies', 'Top 10 Best Action Films');
      expect(result.isWarning).toBe(true);
    });

    it('returns false for completely different titles', () => {
      const result = checkTitleMatch('Top 10 Action Movies', 'Best 5 Comedy Shows');
      expect(result.isDuplicate).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it('detects year variation as not duplicate', () => {
      const result = checkTitleMatch('Top 10 Movies 2024', 'Top 10 Movies 2025');
      expect(result.isYearVariation).toBe(true);
      expect(result.isDuplicate).toBe(false);
    });

    it('handles empty string', () => {
      const result = checkTitleMatch('', '');
      expect(result.isDuplicate).toBe(false);
    });

    it('handles one empty string', () => {
      const result = checkTitleMatch('Top 10 Movies', '');
      expect(result.isDuplicate).toBe(false);
    });

    it('handles very short titles (length < 8, threshold = 1.0)', () => {
      const result = checkTitleMatch('Best', 'Test');
      expect(result.isDuplicate).toBe(false);
      expect(result.isWarning).toBe(false);
    });

    it('short titles require word match count of 2 (length < 8)', () => {
      const result = checkTitleMatch('abc', 'abc');
      expect(result.isDuplicate).toBe(false);
    });

    it('handles very long similar titles', () => {
      const a = 'Top 50 Most Influential and Important Movies That Changed Cinema Forever';
      const b = 'Top 50 Most Influential and Important Films That Changed Cinema Forever';
      const result = checkTitleMatch(a, b);
      expect(result.isDuplicate).toBe(true);
    });

    it('handles titles with year variation correctly', () => {
      const result = checkTitleMatch('Best Movies of 2023', 'Best Movies of 2024');
      expect(result.isYearVariation).toBe(true);
      expect(result.isDuplicate).toBe(false);
    });

    it('handles titles differing by more than year', () => {
      const result = checkTitleMatch('Top 10 Movies 2024', 'Top 10 Shows 2024');
      expect(result.isYearVariation).toBe(false);
    });

    it('returns similarity score between 0 and 100', () => {
      const result = checkTitleMatch('Top 10 Movies', 'Top 20 TV Shows');
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(100);
    });

    it('handles word match requirement despite high character similarity', () => {
      const result = checkTitleMatch('The Great Escape 1963', 'The Great Escap 1963');
      expect(result.similarity).toBeGreaterThanOrEqual(90);
    });
  });
});
