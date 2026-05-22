interface EmptyStateProps {
  message: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ message, action, onAction }: EmptyStateProps) {
  return (
    <div className="px-5 py-10 text-center text-zinc-500">
      <p className="text-base mb-3">{message}</p>
      {action && onAction && (
        <button
          onClick={onAction}
          style={{
            padding: '8px 20px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
