import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TrustSparkline } from '@/components/TrustSparkline';

describe('TrustSparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(
      <TrustSparkline data={[1, 2, 3, 4, 5]} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.tagName).toBe('svg');
  });

  it('renders upward trend in green', () => {
    const { container } = render(
      <TrustSparkline data={[1, 2, 3, 4, 5]} />
    );

    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline?.getAttribute('stroke')).toBe('#4caf50');
  });

  it('renders downward trend in red', () => {
    const { container } = render(
      <TrustSparkline data={[5, 4, 3, 2, 1]} />
    );

    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline?.getAttribute('stroke')).toBe('#f44336');
  });

  it('renders flat trend in gray', () => {
    const { container } = render(
      <TrustSparkline data={[3, 3, 3, 3, 3]} />
    );

    const polyline = container.querySelector('polyline');
    expect(polyline).toBeInTheDocument();
    expect(polyline?.getAttribute('stroke')).toBe('#9e9e9e');
  });

  it('returns nothing for empty data array', () => {
    const { container } = render(
      <TrustSparkline data={[]} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('renders a single data point', () => {
    const { container } = render(
      <TrustSparkline data={[7]} />
    );

    const circle = container.querySelector('circle');
    expect(circle).toBeInTheDocument();
    expect(circle?.getAttribute('fill')).toBe('#9e9e9e');
    expect(circle?.getAttribute('r')).toBe('3');
  });

  it('applies className prop', () => {
    const { container } = render(
      <TrustSparkline data={[1, 2, 3]} className="my-sparkline" />
    );

    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('my-sparkline')).toBe(true);
  });

  it('respects custom width and height', () => {
    const { container } = render(
      <TrustSparkline data={[1, 2, 3]} width={150} height={60} />
    );

    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('150');
    expect(svg?.getAttribute('height')).toBe('60');
  });
});
