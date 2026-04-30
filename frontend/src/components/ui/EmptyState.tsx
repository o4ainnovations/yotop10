interface EmptyStateProps {
  message: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ message, action, onAction }: EmptyStateProps) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
      <p style={{ fontSize: '16px', marginBottom: '12px' }}>{message}</p>
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
