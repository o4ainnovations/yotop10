import { describe, it, expect } from 'vitest';
import { validateListTitle, needsListTitleValidation } from '../lib/listTitleValidation';

describe('listTitleValidation', () => {
  describe('needsListTitleValidation', () => {
    it('returns true for list post types', () => {
      expect(needsListTitleValidation('top_list')).toBe(true);
      expect(needsListTitleValidation('best_of')).toBe(true);
      expect(needsListTitleValidation('worst_of')).toBe(true);
      expect(needsListTitleValidation('hidden_gems')).toBe(true);
      expect(needsListTitleValidation('counter_list')).toBe(true);
    });

    it('returns false for non-list post types', () => {
      expect(needsListTitleValidation('review')).toBe(false);
      expect(needsListTitleValidation('article')).toBe(false);
      expect(needsListTitleValidation('')).toBe(false);
      expect(needsListTitleValidation('hero_list')).toBe(false);
    });
  });

  describe('validateListTitle', () => {
    describe('valid titles', () => {
      it('accepts standard list titles', () => {
        expect(validateListTitle('Top 10 Movies of All Time')).toEqual({
          valid: true,
          number: 10,
        });
      });

      it('accepts Best X format', () => {
        expect(validateListTitle('Best 5 Restaurants')).toEqual({
          valid: true,
          number: 5,
        });
      });

      it('accepts numeric-first titles', () => {
        expect(validateListTitle('25 Greatest Albums')).toEqual({
          valid: true,
          number: 25,
        });
      });

      it('accepts minimum allowed number (3)', () => {
        expect(validateListTitle('Top 3 Things')).toEqual({
          valid: true,
          number: 3,
        });
      });

      it('accepts maximum allowed number (100)', () => {
        expect(validateListTitle('Top 100 Movies')).toEqual({
          valid: true,
          number: 100,
        });
      });

      it('accepts hidden gems format', () => {
        expect(validateListTitle('10 Hidden Treasures')).toEqual({
          valid: true,
          number: 10,
        });
      });

      it('accepts influential keyword', () => {
        expect(validateListTitle('50 Most Influential People')).toEqual({
          valid: true,
          number: 50,
        });
      });

      it('accepts underrated keyword', () => {
        expect(validateListTitle('10 Underrated Films')).toEqual({
          valid: true,
          number: 10,
        });
      });

      it('accepts essential keyword', () => {
        expect(validateListTitle('20 Essential Albums')).toEqual({
          valid: true,
          number: 20,
        });
      });

      it('accepts controversial keyword', () => {
        expect(validateListTitle('7 Most Controversial Games')).toEqual({
          valid: true,
          number: 7,
        });
      });

      it('accepts must-watch keyword', () => {
        expect(validateListTitle('15 Must-Watch Shows')).toEqual({
          valid: true,
          number: 15,
        });
      });
    });

    describe('error: NO_NUMBER', () => {
      it('rejects titles with no number', () => {
        const result = validateListTitle('Some Cool Things');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NO_NUMBER');
        expect(result.error).toBeDefined();
      });

      it('rejects empty string', () => {
        const result = validateListTitle('');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NO_NUMBER');
      });

      it('rejects non-string input', () => {
        const result = validateListTitle(undefined as unknown as string);
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NO_NUMBER');
      });
    });

    describe('error: NUMBER_TOO_SMALL', () => {
      it('rejects number less than 3', () => {
        const result = validateListTitle('Top 2 Movies');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NUMBER_TOO_SMALL');
        expect(result.number).toBe(2);
      });

      it('rejects 0', () => {
        const result = validateListTitle('Top 0 Movies');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NUMBER_TOO_SMALL');
        expect(result.number).toBe(0);
      });

      it('rejects 1', () => {
        const result = validateListTitle('Best 1 Thing');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NUMBER_TOO_SMALL');
        expect(result.number).toBe(1);
      });
    });

    describe('error: NUMBER_TOO_LARGE', () => {
      it('rejects number greater than 100', () => {
        const result = validateListTitle('Top 101 Movies');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NUMBER_TOO_LARGE');
        expect(result.number).toBe(101);
      });

      it('rejects very large numbers', () => {
        const result = validateListTitle('Top 999 Movies');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NUMBER_TOO_LARGE');
        expect(result.number).toBe(999);
      });
    });

    describe('error: NO_RANKING_KEYWORD', () => {
      it('rejects titles with number but no ranking keyword', () => {
        const result = validateListTitle('10 Movies I Like');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NO_RANKING_KEYWORD');
        expect(result.number).toBe(10);
      });

      it('rejects titles where ranking keyword is far from the number', () => {
        const result = validateListTitle('A long title about a collection of things that happened many years ago and were truly remarkable in every way is this 10 item compilation');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('NO_RANKING_KEYWORD');
      });
    });

    describe('error: ALL_TIME_WITH_YEAR', () => {
      it('rejects all-time with year anywhere in title', () => {
        const result = validateListTitle('Top 10 Movies of All Time 2023');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('ALL_TIME_WITH_YEAR');
      });

      it('rejects "all time" (no "of") with year', () => {
        const result = validateListTitle('Top 10 All Time Movies 2024');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('ALL_TIME_WITH_YEAR');
      });

      it('rejects year at the beginning with all-time', () => {
        const result = validateListTitle('2024 Best 10 Things of All Time');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('ALL_TIME_WITH_YEAR');
      });
    });

    describe('ALL_TIME_WITH_YEAR takes priority over other validations', () => {
      it('returns ALL_TIME_WITH_YEAR even when number and keyword are valid', () => {
        const result = validateListTitle('Top 10 Movies of All Time 2024');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('ALL_TIME_WITH_YEAR');
        expect(result.error).toBe(
          'Titles with "of all time" or "all time" cannot include a year — they are contradictory',
        );
      });

      it('returns ALL_TIME_WITH_YEAR even when number would be too small', () => {
        const result = validateListTitle('Top 2 of All Time 1998');
        expect(result.valid).toBe(false);
        expect(result.code).toBe('ALL_TIME_WITH_YEAR');
      });
    });

    describe('edge cases', () => {
      it('handles special characters in title', () => {
        const result = validateListTitle('Top 10 — Movies & Shows (2022)');
        expect(result.valid).toBe(true);
        expect(result.number).toBe(10);
      });

      it('handles mixed case titles', () => {
        const result = validateListTitle('tOp 10 mOvIeS oF aLL tImE');
        expect(result.valid).toBe(true);
        expect(result.number).toBe(10);
      });

      it('handles three-digit numbers (100)', () => {
        const result = validateListTitle('Top 100 Albums');
        expect(result.valid).toBe(true);
        expect(result.number).toBe(100);
      });

      it('uses first number found in title', () => {
        const result = validateListTitle('Top 10 Best 5 Movies');
        expect(result.valid).toBe(true);
        expect(result.number).toBe(10);
      });

      it('extracts number from middle of title', () => {
        const result = validateListTitle('The 42 Best Films');
        expect(result.valid).toBe(true);
        expect(result.number).toBe(42);
      });
    });
  });
});
