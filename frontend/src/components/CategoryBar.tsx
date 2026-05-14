'use client';

import Link from 'next/link';

interface CategoryBarProps {
  active?: string;
}

const PARENT_CATEGORIES = [
  { slug: 'movies', label: 'Movies' },
  { slug: 'music', label: 'Music' },
  { slug: 'food', label: 'Food' },
  { slug: 'gaming', label: 'Gaming' },
  { slug: 'books', label: 'Books' },
  { slug: 'technology', label: 'Tech' },
  { slug: 'sports', label: 'Sports' },
  { slug: 'television', label: 'TV' },
  { slug: 'business', label: 'Business' },
  { slug: 'lifestyle', label: 'Lifestyle' },
];

export function CategoryBar({ active }: CategoryBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0',
        overflowX: 'auto',
        borderBottom: '2px solid var(--border-primary)',
        marginBottom: '0',
      }}
    >
      <Link
        href="/"
        style={{
          padding: '10px 18px',
          fontSize: '13px',
          fontWeight: 700,
          textDecoration: 'none',
          color: !active ? 'var(--accent)' : 'var(--text-muted)',
          borderBottom: !active ? '2px solid var(--accent)' : '2px solid transparent',
          marginBottom: '-2px',
          backgroundColor: !active ? 'var(--accent-soft)' : 'transparent',
          textTransform: 'uppercase',
          letterSpacing: '0.6px',
          whiteSpace: 'nowrap',
          transition: 'color var(--transition), border-color var(--transition), background var(--transition)',
        }}
      >
        All
      </Link>
      {PARENT_CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/c/${cat.slug}`}
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 700,
            textDecoration: 'none',
            color: active === cat.slug ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: active === cat.slug ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: active === cat.slug ? 'var(--accent-soft)' : 'transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            whiteSpace: 'nowrap',
            transition: 'color var(--transition), border-color var(--transition), background var(--transition)',
          }}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
