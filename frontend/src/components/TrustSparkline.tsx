'use client';

interface TrustSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function TrustSparkline({
  data,
  width = 200,
  height = 40,
  className,
}: TrustSparklineProps) {
  const clampedHeight = Math.max(20, height);

  if (data.length === 0) {
    return null;
  }

  if (data.length === 1) {
    const y = clampedHeight / 2;
    const x = width / 2;
    const color = '#9e9e9e';
    return (
      <svg
        width={width}
        height={clampedHeight}
        viewBox={`0 0 ${width} ${clampedHeight}`}
        className={className}
        aria-label="Trust score sparkline"
        role="img"
      >
        <circle cx={x} cy={y} r={3} fill={color} />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);

  const first = data[0];
  const last = data[data.length - 1];

  let color: string;
  if (last > first) {
    color = '#4caf50';
  } else if (last < first) {
    color = '#f44336';
  } else {
    color = '#9e9e9e';
  }

  const padding = 2;

  let points: string;
  if (max === min) {
    const flatY = clampedHeight / 2;
    const x1 = padding;
    const x2 = width - padding;
    points = `${x1},${flatY} ${x2},${flatY}`;
  } else {
    const range = max - min;
    points = data
      .map((value, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y =
          clampedHeight -
          padding -
          ((value - min) / range) * (clampedHeight - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }

  return (
    <svg
      width={width}
      height={clampedHeight}
      viewBox={`0 0 ${width} ${clampedHeight}`}
      className={className}
      aria-label="Trust score sparkline"
      role="img"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
