import Link from 'next/link';
import { Icon } from './icons/Icon';

export function DesktopCta({ className = '' }: { className?: string }) {
  return (
    <section className={`${className}`}>
      <div className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-orange-500/[0.03] to-pink-500/[0.03] p-8 text-center transition hover:border-orange-500/20 hover:from-orange-500/[0.05] hover:to-pink-500/[0.05]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-pink-500/15">
          <Icon name="Sparkles" size={22} className="text-orange-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Share Your Perspective</h3>
        <p className="text-sm text-zinc-500 leading-relaxed max-w-lg mx-auto mb-6">
          Have a ranking, debate, or fact to share? Submit your post and join a growing community of curators.
        </p>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl hover:scale-[1.02]"
        >
          <Icon name="Plus" size={16} />
          Submit a List
        </Link>
      </div>
    </section>
  );
}
