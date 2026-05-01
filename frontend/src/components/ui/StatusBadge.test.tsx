import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders approved badge', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('renders pending_review badge with underscore replaced', () => {
    render(<StatusBadge status="pending_review" />);
    expect(screen.getByText('pending review')).toBeInTheDocument();
  });

  it('renders rejected badge', () => {
    render(<StatusBadge status="rejected" />);
    expect(screen.getByText('rejected')).toBeInTheDocument();
  });

  it('renders unknown status as-is', () => {
    render(<StatusBadge status="archived" />);
    expect(screen.getByText('archived')).toBeInTheDocument();
  });
});
