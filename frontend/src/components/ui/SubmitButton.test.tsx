import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SubmitButton from '@/components/ui/SubmitButton';

describe('SubmitButton', () => {
  it('renders default label', () => {
    render(<SubmitButton />);
    expect(screen.getByText('Submit')).toBeInTheDocument();
  });

  it('renders custom label', () => {
    render(<SubmitButton label="Save Changes" />);
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('shows loading label when loading', () => {
    render(<SubmitButton loading />);
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<SubmitButton loading />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<SubmitButton disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
