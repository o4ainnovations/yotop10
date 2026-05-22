interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="bg-red-50 border border-red-600 rounded px-5 py-4 my-5 flex items-center justify-between"
    >
      <span className="text-red-800">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '6px 16px',
            backgroundColor: '#d32f2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
