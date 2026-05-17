import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { ArgumentCard } from '@/components/ArgumentCard';
import type { ArgumentPost } from '@/lib/api/types';

vi.mock('./icons/Icon', () => ({
  Icon: (props: { name: string; size?: number }) =>
    React.createElement('span', {
      'data-testid': 'icon',
      'data-name': props.name,
    }),
}));

vi.mock('./ArgumentBar', () => ({
  ArgumentBar: (props: { supportPct: number; contradictPct: number }) =>
    React.createElement('div', {
      'data-testid': 'argument-bar',
      'data-support': props.supportPct,
      'data-contradict': props.contradictPct,
    }),
}));

vi.mock('@/lib/dates', () => ({
  relativeTime: () => '17h',
}));

const basePost: ArgumentPost = {
  id: 'abc123',
  slug: 'cats-vs-dogs-abc123',
  title: 'Cats vs Dogs',
  post_type: 'this_vs_that',
  category_slug: 'animals',
  author_username: 'a_9Gh7',
  author_display_name: 'a_9Gh7',
  comment_count: 25,
  view_count: 150,
  argument_score: 42.5,
  velocity: 3.2,
  last_active: '2026-05-17T00:00:00.000Z',
  top_comments: [],
  support_pct: 60,
  contradict_pct: 40,
};

describe('ArgumentCard', () => {
  it('renders without crashing', () => {
    render(<ArgumentCard argument={basePost} />);
    expect(screen.getByText('Cats vs Dogs')).toBeInTheDocument();
  });

  it('displays the category slug badge', () => {
    render(<ArgumentCard argument={basePost} />);
    expect(screen.getByText('animals')).toBeInTheDocument();
  });

  it('displays the post type label', () => {
    render(<ArgumentCard argument={basePost} />);
    expect(screen.getByText('THIS VS THAT')).toBeInTheDocument();
  });

  it('shows velocity when greater than zero', () => {
    render(<ArgumentCard argument={basePost} />);
    expect(screen.getByText('3.2 replies/hour')).toBeInTheDocument();
  });

  it('renders ArgumentBar with correct percentages', () => {
    render(<ArgumentCard argument={basePost} />);
    const bar = screen.getByTestId('argument-bar');
    expect(bar).toHaveAttribute('data-support', '60');
    expect(bar).toHaveAttribute('data-contradict', '40');
  });

  it('displays author username with @ prefix', () => {
    render(<ArgumentCard argument={basePost} />);
    expect(screen.getByText('@a_9Gh7')).toBeInTheDocument();
  });

  it('renders link to post detail page via slug', () => {
    render(<ArgumentCard argument={basePost} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/cats-vs-dogs-abc123');
  });
});
