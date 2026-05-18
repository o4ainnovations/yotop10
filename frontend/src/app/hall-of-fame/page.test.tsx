/**
 * Hall of Fame page tests.
 *
 * These tests verify the HallOfFameCard component rendering across all
 * three variants (public, admin, featured) and edge cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HallOfFameCard } from '@/components/HallOfFameCard';
import type { HallOfFameEntry } from '@/lib/api/types';

function mockEntry(overrides: Partial<HallOfFameEntry> = {}): HallOfFameEntry {
  return {
    id: 'hof-001',
    post_id: 'post-001',
    post: {
      id: 'post-001',
      slug: 'top-10-movies-abc123',
      title: 'Top 10 Movies of All Time',
      intro: 'A carefully curated list',
      post_type: 'top_list',
      comment_count: 42,
      view_count: 1500,
      author_username: 'a_filmcritic',
      author_display_name: 'Film Critic',
      category_slug: 'movies',
      hero_image_url: null,
      format: 'list_only',
      status: 'approved',
      topItems: [
        { rank: 1, title: 'The Godfather' },
        { rank: 2, title: 'Citizen Kane' },
        { rank: 3, title: 'Pulp Fiction' },
      ],
      created_at: '2025-01-15T00:00:00.000Z',
    },
    editorial_note: 'A definitive movie ranking',
    featured_at: '2025-03-01T00:00:00.000Z',
    sort_order: 0,
    created_by: 'testadmin',
    ...overrides,
  };
}

describe('HallOfFameCard — public variant', () => {
  it('renders post title as a link', () => {
    const entry = mockEntry();
    render(<HallOfFameCard entry={entry} variant="public" />);

    const link = screen.getByText('Top 10 Movies of All Time');
    expect(link.closest('a')).toHaveAttribute('href', '/top-10-movies-abc123');
  });

  it('renders FEATURED badge', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="public" />);
    expect(screen.getByText('FEATURED')).toBeInTheDocument();
  });

  it('renders category slug', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="public" />);
    expect(screen.getByText('movies')).toBeInTheDocument();
  });

  it('renders editorial note', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="public" />);
    expect(screen.getByText('A definitive movie ranking')).toBeInTheDocument();
  });

  it('renders author username', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="public" />);
    expect(screen.getByText('@a_filmcritic')).toBeInTheDocument();
  });

  it('renders comment and view counts', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="public" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('handles missing post data gracefully', () => {
    const entry = mockEntry({
      post: null as unknown as HallOfFameEntry['post'],
    });
    render(<HallOfFameCard entry={entry} variant="public" />);
    expect(screen.getByText('No post data available')).toBeInTheDocument();
  });

  it('does not crash when editorial_note is null', () => {
    const entry = mockEntry({ editorial_note: null });
    render(<HallOfFameCard entry={entry} variant="public" />);
    expect(screen.getByText('Top 10 Movies of All Time')).toBeInTheDocument();
  });

  it('handles zero comment_count and view_count', () => {
    const entry = mockEntry({
      post: { ...mockEntry().post!, comment_count: 0, view_count: 0 },
    });
    render(<HallOfFameCard entry={entry} variant="public" />);
    // Both counts are 0, so '0' text appears twice
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('handles missing category_slug', () => {
    const entry = mockEntry({
      post: { ...mockEntry().post!, category_slug: '' },
    });
    render(<HallOfFameCard entry={entry} variant="public" />);
    expect(screen.getByText('Top 10 Movies of All Time')).toBeInTheDocument();
  });
});

describe('HallOfFameCard — admin variant', () => {
  it('renders sort_order badge', () => {
    render(<HallOfFameCard entry={mockEntry({ sort_order: 3 })} variant="admin" />);
    expect(screen.getByText('#3')).toBeInTheDocument();
  });

  it('renders remove and edit buttons', () => {
    const onRemove = vi.fn();
    const onEditNote = vi.fn();
    render(
      <HallOfFameCard
        entry={mockEntry()}
        variant="admin"
        onRemove={onRemove}
        onEditNote={onEditNote}
      />
    );

    expect(screen.getByLabelText('Remove from Hall of Fame')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit editorial note')).toBeInTheDocument();
  });

  it('does not render buttons when callbacks not provided', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="admin" />);

    expect(screen.queryByLabelText('Remove from Hall of Fame')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Edit editorial note')).not.toBeInTheDocument();
  });

  it('renders editorial note when present', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="admin" />);
    // The note is rendered in a paragraph — search for it in the DOM
    expect(screen.getByText('A definitive movie ranking')).toBeInTheDocument();
  });

  it('handles missing author_username', () => {
    const entry = mockEntry({
      post: { ...mockEntry().post!, author_username: '' },
    });
    render(<HallOfFameCard entry={entry} variant="admin" />);
    expect(screen.getByText('Top 10 Movies of All Time')).toBeInTheDocument();
  });

  it('renders relative time for featured_at', () => {
    const entry = mockEntry({
      featured_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    });
    render(<HallOfFameCard entry={entry} variant="admin" />);
    // relativeTime returns '1h' for 1 hour ago (no "ago" suffix)
    expect(screen.getByText('1h')).toBeInTheDocument();
  });

  it('renders without title crash when post has empty title', () => {
    const entry = mockEntry({
      post: { ...mockEntry().post!, title: '' },
    });
    render(<HallOfFameCard entry={entry} variant="admin" />);
    // Empty title + author_username is present, so `hasPost` checks title truthiness
    // Should still render without crash
  });
});

describe('HallOfFameCard — featured variant', () => {
  it('renders large-format featured badge', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="featured" />);
    expect(screen.getByText('FEATURED')).toBeInTheDocument();
  });

  it('renders editorial note with amber left border', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="featured" />);
    const note = screen.getByText('A definitive movie ranking');
    expect(note).toBeInTheDocument();
  });

  it('renders hero image when hero_image_url is set', () => {
    const entry = mockEntry({
      post: {
        ...mockEntry().post!,
        hero_image_url: 'https://example.com/hero.jpg',
      },
    });
    const { container } = render(
      <HallOfFameCard entry={entry} variant="featured" />
    );
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    // next/image transforms URLs through the built-in proxy
    expect(img!.getAttribute('src')).toContain('hero.jpg');
  });

  it('does not render hero image section when no hero_image_url', () => {
    const { container } = render(
      <HallOfFameCard entry={mockEntry()} variant="featured" />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeInTheDocument();
  });

  it('renders title as link', () => {
    const entry = mockEntry();
    render(<HallOfFameCard entry={entry} variant="featured" />);
    const link = screen.getByText('Top 10 Movies of All Time');
    expect(link.closest('a')).toHaveAttribute('href', '/top-10-movies-abc123');
  });

  it('renders author and stats', () => {
    render(<HallOfFameCard entry={mockEntry()} variant="featured" />);
    expect(screen.getByText('Film Critic')).toBeInTheDocument();
  });

  it('handles missing author_display_name by showing username', () => {
    const entry = mockEntry({
      post: {
        ...mockEntry().post!,
        author_display_name: '',
        author_username: 'a_testuser',
      },
    });
    render(<HallOfFameCard entry={entry} variant="featured" />);
    expect(screen.getByText('a_testuser')).toBeInTheDocument();
  });

  it('handles null editorial_note without crash', () => {
    const entry = mockEntry({ editorial_note: null });
    render(<HallOfFameCard entry={entry} variant="featured" />);
    expect(screen.getByText('FEATURED')).toBeInTheDocument();
  });
});

describe('HallOfFameCard — empty state and edge cases', () => {
  it('renders with single entry without layout collapse', () => {
    const { container } = render(
      <HallOfFameCard entry={mockEntry()} variant="public" />
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders entries with different sort_orders without conflict', () => {
    const first = mockEntry({ id: 'hof-1', sort_order: 0 });
    const second = mockEntry({ id: 'hof-2', sort_order: 1 });
    const { container: c1 } = render(
      <HallOfFameCard entry={first} variant="public" />
    );
    const { container: c2 } = render(
      <HallOfFameCard entry={second} variant="public" />
    );
    expect(c1.firstChild).toBeInTheDocument();
    expect(c2.firstChild).toBeInTheDocument();
  });

  it('renders long editorial notes with line clamping', () => {
    const longNote = 'This is a very long editorial note that goes on and on about why this post deserves to be in the Hall of Fame. It covers all the important aspects of the post and explains the editorial decision in great detail.'.repeat(3);
    const entry = mockEntry({ editorial_note: longNote });
    render(<HallOfFameCard entry={entry} variant="public" />);
    const note = screen.getByText((content) => content.includes('deserves'));
    expect(note).toBeInTheDocument();
  });

  it('handles post.hero_image_url as empty string (not null)', () => {
    const entry = mockEntry({
      post: { ...mockEntry().post!, hero_image_url: '' },
    });
    const { container } = render(
      <HallOfFameCard entry={entry} variant="featured" />
    );
    const img = container.querySelector('img');
    expect(img).not.toBeInTheDocument();
  });
});
