import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export const dynamic = 'force-dynamic';

export default function GlobalNotFound() {
  return (
    <div className="mx-auto max-w-[800px] px-5 py-10 text-center">
      <h1>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
      <p><Link href="/"><Icon name="ArrowLeft" size={16} className="inline mr-1" /> Go back home</Link></p>
    </div>
  );
}
