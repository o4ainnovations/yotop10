import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function GlobalNotFound() {
  return (
    <div className="mx-auto max-w-[800px] px-5 py-10 text-center">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <p><Link href="/">← Go back home</Link></p>
    </div>
  );
}
