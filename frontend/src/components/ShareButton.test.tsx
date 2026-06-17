import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const mockTrackShare = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('@/lib/api', () => ({
  API: {
    trackShare: (...args: unknown[]) => mockTrackShare(...args),
  },
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('./icons/Icon', () => ({
  Icon: (props: { name: string; size?: number }) =>
    React.createElement('span', {
      'data-testid': 'icon',
      'data-name': props.name,
    }),
}));

import { ShareButton, buildShareUrl } from '@/components/ShareButton';

describe('ShareButton', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('renders without crashing', () => {
    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label', 'Share Test Post');
  });

  it('builds correct UTM URL', () => {
    const originalOrigin = window.location.origin;
    Object.defineProperty(window, 'location', { value: { origin: 'https://yotop10.fun' }, configurable: true });
    const url = buildShareUrl('test-post-abc', 'post123');
    expect(url).toBe('https://yotop10.fun/test-post-abc?utm_source=share&utm_medium=user&utm_campaign=post_post123');
    Object.defineProperty(window, 'location', { value: { origin: originalOrigin }, configurable: true });
  });

  it('copies UTM URL to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    mockTrackShare.mockResolvedValue({ success: true });

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(async () => {
      await screen.findByText('Copy');
    });

    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'http://localhost:3000/test-post?utm_source=share&utm_medium=user&utm_campaign=post_post123'
      );
    });
  });

  it('shows success toast after copying', async () => {
    mockTrackShare.mockResolvedValue({ success: true });

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    fireEvent.click(screen.getByRole('button'));

    await screen.findByText('Copy');
    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Link copied!');
    });
  });

  it('calls API.trackShare after click', async () => {
    mockTrackShare.mockResolvedValue({ success: true });

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockTrackShare).toHaveBeenCalledWith('test-post');
    });
  });

  it('shows error toast when clipboard fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')),
      },
      configurable: true,
    });

    mockTrackShare.mockResolvedValue({ success: true });

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    fireEvent.click(screen.getByRole('button'));

    await screen.findByText('Copy');
    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Failed to copy link');
    });
  });

  it('does not crash when trackShare API fails', async () => {
    mockTrackShare.mockRejectedValue(new Error('Network error'));

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    fireEvent.click(screen.getByRole('button'));

    await screen.findByText('Copy');
    fireEvent.click(screen.getByText('Copy'));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Link copied!');
    });
  });

  it('disables button while pending', async () => {
    mockTrackShare.mockImplementation(
      () => new Promise(() => { /* never resolves */ })
    );

    render(<ShareButton slug="test-post" title="Test Post" postId="post123" />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });
  });
});
