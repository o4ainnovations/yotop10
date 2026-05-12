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
        borderBottom: '2px solid #ff2d78',
        marginBottom: '0',
      }}
    >
      <Link
        href="/"
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 'bold',
          textDecoration: 'none',
          color: !active ? '#ff2d78' : '#94a3b8',
          borderBottom: !active ? '2px solid #ff2d78' : '2px solid transparent',
          marginBottom: '-2px',
          backgroundColor: !active ? 'rgba(255,45,120,0.08)' : 'transparent',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          whiteSpace: 'nowrap',
        }}
      >
        All
      </Link>
      {PARENT_CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/c/${cat.slug}`}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 'bold',
            textDecoration: 'none',
            color: active === cat.slug ? '#ff2d78' : '#94a3b8',
            borderBottom: active === cat.slug ? '2px solid #ff2d78' : '2px solid transparent',
            marginBottom: '-2px',
            backgroundColor: active === cat.slug ? 'rgba(255,45,120,0.08)' : 'transparent',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          {cat.label}
        </Link>
      ))}
    </div>
  );
}
