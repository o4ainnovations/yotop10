import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function GlobalNotFound() {
  return (
    <div className="mx-auto min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 text-center bg-[var(--color-bg)]">
      <span className="text-[120px] sm:text-[160px] font-bold leading-none text-white select-none">
        404
      </span>
      <h1 className="mt-4 text-xl font-bold text-white sm:text-2xl">Page Not Found</h1>
      <p className="mt-2 text-sm text-zinc-500 max-w-sm leading-relaxed">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
      >
        Go back home
      </Link>
    </div>
  );
}
