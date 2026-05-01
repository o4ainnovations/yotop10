import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharacterCounter from '@/components/ui/CharacterCounter';

describe('CharacterCounter', () => {
  it('renders current and max values', () => {
    render(<CharacterCounter current={150} max={300} />);
    expect(screen.getByText('150/300')).toBeInTheDocument();
  });

  it('uses warning color above 80%', () => {
    render(<CharacterCounter current={81} max={100} />);
    const span = screen.getByText('81/100');
    expect(span.style.color).toBe('rgb(255, 152, 0)');
  });
});
