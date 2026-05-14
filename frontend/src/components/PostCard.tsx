'use client';

import Link from 'next/link';
import { Icon } from './icons/Icon';
import type { Post } from '@/lib/api/types';

const POST_TYPE_LABELS: Record<string, string> = {
  top_list: 'Ranked List',
  this_vs_that: 'This vs That',
  who_is_better: 'Who Is Better',
  fact_drop: 'Fact Drop',
  best_of: 'Best Of',
  worst_of: 'Worst Of',
  hidden_gems: 'Hidden Gems',
  counter_list: 'Counter List',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(then).toLocaleDateString();
}

export function PostCard({ post }: { post: Post }) {
  const isCounter = post.post_type === 'counter_list';
  const label = POST_TYPE_LABELS[post.post_type] || post.post_type;

  return (
    <Link
      href={`/${post.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          boxShadow: 'var(--shadow-sm)',
          transition: 'border-color var(--transition), box-shadow var(--transition)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-primary)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {isCounter && (
              <span style={{ color: 'var(--accent)', fontFamily: 'Geist Mono, monospace', fontSize: '14px', fontWeight: 'bold' }}>
                {'\u21B3'}
              </span>
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--accent)',
                border: '1.5px solid var(--accent)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 8px',
                textTransform: 'capitalize',
              }}
            >
              {post.category_slug}
            </span>
          </div>
        </div>

        <h3
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h3>

        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {post.intro}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <span>
            <span style={{ fontFamily: 'Geist Mono, monospace', color: 'var(--text-secondary)' }}>
              {post.author_display_name}
            </span>
            <span style={{ margin: '0 8px', color: 'var(--border-primary)' }}>&middot;</span>
            {timeAgo(post.created_at)}
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="ChartBar" size={13} color="var(--text-muted)" />
              <span>
                {post.view_count > 1000
                  ? `${(post.view_count / 1000).toFixed(1)}k`
                  : post.view_count}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="MessageCircle" size={13} color="var(--text-muted)" />
              <span>{post.comment_count}</span>
            </span>
          </span>
        </div>
      </article>
    </Link>
  );
}
