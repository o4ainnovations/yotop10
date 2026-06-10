import Link from 'next/link';

interface Crumb {
  label: string;
  href: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-2xs text-zinc-600 mb-4 overflow-x-auto">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-zinc-700">/</span>}
          {i < items.length - 1 ? (
            <Link href={item.href} className="hover:text-orange-400 transition whitespace-nowrap">{item.label}</Link>
          ) : (
            <span className="text-zinc-400 whitespace-nowrap">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
