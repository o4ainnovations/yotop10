interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const sizeMap = { sm: 16, md: 24, lg: 40 };

export default function LoadingSpinner({ size = 'md', label = 'Loading...' }: LoadingSpinnerProps) {
  const px = sizeMap[size];

  return (
    <div className="p-10 text-center">
      <div
        style={{
          display: 'inline-block',
          width: px,
          height: px,
          border: `${Math.max(2, px / 8)}px solid #ccc`,
          borderTopColor: '#0066cc',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }}
        role="status"
        aria-label={label}
      />
      <p className="mt-2 text-zinc-500">{label}</p>
    </div>
  );
}
