'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/5">
        <span className="text-3xl font-bold text-white/30">!</span>
      </div>
      <h1 className="mb-3 text-xl font-bold text-white">Something went wrong</h1>
      <p className="mb-8 text-sm text-zinc-500 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
      >
        Try Again
      </button>
    </div>
  );
}
