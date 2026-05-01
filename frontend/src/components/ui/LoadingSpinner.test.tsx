import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default label', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<LoadingSpinner label="Fetching..." />);
    expect(screen.getByText('Fetching...')).toBeInTheDocument();
  });

  it('renders with role status for accessibility', () => {
    render(<LoadingSpinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
