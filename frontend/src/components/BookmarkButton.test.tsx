import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockSave = vi.fn();
const mockUnsave = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastInfo = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/api', () => ({
  API: {
    save: (...args: unknown[]) => mockSave(...args),
    unsave: (...args: unknown[]) => mockUnsave(...args),
  },
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('./icons/Icon', () => ({
  Icon: (props: { name: string; fill?: string; size?: number }) =>
    React.createElement('span', {
      'data-testid': 'icon',
      'data-name': props.name,
      'data-fill': props.fill,
    }),
}));

import { BookmarkButton } from '@/components/BookmarkButton';

describe('BookmarkButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<BookmarkButton postId="post1" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Bookmark this post');
  });

  it('renders with initial bookmarked state', () => {
    render(<BookmarkButton postId="post1" initialBookmarked={true} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Remove bookmark');
  });

  it('calls API.save on click when not bookmarked', async () => {
    mockSave.mockResolvedValue({ saved: true });

    render(<BookmarkButton postId="post1" initialBookmarked={false} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith('post1');
    });
  });

  it('calls API.unsave on click when bookmarked', async () => {
    mockUnsave.mockResolvedValue({ removed: true });

    render(<BookmarkButton postId="post1" initialBookmarked={true} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockUnsave).toHaveBeenCalledWith('post1');
    });
  });

  it('shows success toast after saving', async () => {
    mockSave.mockResolvedValue({ saved: true });

    render(<BookmarkButton postId="post1" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Saved to Bookmarks');
    });
  });

  it('shows info toast after unsaving', async () => {
    mockUnsave.mockResolvedValue({ removed: true });

    render(<BookmarkButton postId="post1" initialBookmarked={true} />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith('Removed from Bookmarks');
    });
  });

  it('shows error toast and reverts state on API failure', async () => {
    mockSave.mockRejectedValue(new Error('Network error'));

    render(<BookmarkButton postId="post1" initialBookmarked={false} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Something went wrong. Please try again.'
      );
    });
    expect(button).toHaveAttribute('aria-label', 'Bookmark this post');
  });

  it('disables button while request is pending', () => {
    mockSave.mockImplementation(
      () => new Promise(() => { /* never resolves */ })
    );

    render(<BookmarkButton postId="post1" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toBeDisabled();
  });
});
