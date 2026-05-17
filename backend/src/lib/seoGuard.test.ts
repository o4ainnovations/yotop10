import { describe, it, expect } from 'vitest';
import { shouldNoIndex, SeoSignals } from './seoGuard';

describe('seoGuard', () => {
  describe('shouldNoIndex', () => {
    it('returns false for approved + engaged post (index)', () => {
      const signals: SeoSignals = {
        comment_count: 5,
        view_count: 100,
        content_length: 500,
        status: 'approved',
        age_hours: 72,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('returns true for pending_review post (noindex)', () => {
      const signals: SeoSignals = {
        comment_count: 10,
        view_count: 200,
        content_length: 500,
        status: 'pending_review',
        age_hours: 1,
      };
      expect(shouldNoIndex(signals)).toBe(true);
    });

    it('returns true for rejected post (noindex)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 500,
        status: 'rejected',
        age_hours: 10,
      };
      expect(shouldNoIndex(signals)).toBe(true);
    });

    it('returns true for stale post (0 comments, 0 views, >48h) (noindex)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 500,
        status: 'approved',
        age_hours: 72,
      };
      expect(shouldNoIndex(signals)).toBe(true);
    });

    it('returns false for stale but <48h (index)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 500,
        status: 'approved',
        age_hours: 24,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('returns true for thin content (<100 chars) + >24h (noindex)', () => {
      const signals: SeoSignals = {
        comment_count: 1,
        view_count: 5,
        content_length: 50,
        status: 'approved',
        age_hours: 48,
      };
      expect(shouldNoIndex(signals)).toBe(true);
    });

    it('returns false for thin content but <24h (index)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 50,
        status: 'approved',
        age_hours: 12,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('returns false for normal content (index)', () => {
      const signals: SeoSignals = {
        comment_count: 2,
        view_count: 10,
        content_length: 200,
        status: 'approved',
        age_hours: 100,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('handles zero content length edge case', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 0,
        status: 'approved',
        age_hours: 25,
      };
      expect(shouldNoIndex(signals)).toBe(true);
    });

    it('returns false for very old but highly engaged post (index)', () => {
      const signals: SeoSignals = {
        comment_count: 500,
        view_count: 50000,
        content_length: 300,
        status: 'approved',
        age_hours: 8760,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('returns false for exactly at content_length boundary (100) (index)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 100,
        status: 'approved',
        age_hours: 48,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });

    it('returns false for exactly at age boundary (48h) with zero engagement (index)', () => {
      const signals: SeoSignals = {
        comment_count: 0,
        view_count: 0,
        content_length: 200,
        status: 'approved',
        age_hours: 48,
      };
      expect(shouldNoIndex(signals)).toBe(false);
    });
  });
});
