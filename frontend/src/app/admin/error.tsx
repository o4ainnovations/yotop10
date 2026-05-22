'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto my-[100px] max-w-[600px] p-10 text-center">
      <h1>Something went wrong</h1>
      <p className="text-zinc-500 my-5">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        style={{
          padding: '10px 24px',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
