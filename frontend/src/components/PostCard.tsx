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

const POST_TYPE_COLORS: Record<string, string> = {
  counter_list: '#00d4aa',
  this_vs_that: '#ff2d78',
  who_is_better: '#ff2d78',
  worst_of: '#ff2d78',
  top_list: '#888',
  fact_drop: '#888',
  best_of: '#888',
  hidden_gems: '#888',
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
  const badgeColor = POST_TYPE_COLORS[post.post_type] || '#888';
  const label = POST_TYPE_LABELS[post.post_type] || post.post_type;

  return (
    <Link
      href={`/${post.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <article
        style={{
          border: `2px solid ${badgeColor}`,
          borderRadius: '0',
          padding: '16px',
          backgroundColor: '#111827',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#ff2d78'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = badgeColor; }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {isCounter && (
              <span style={{ color: '#00d4aa', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold' }}>
                {'\u21B3'}
              </span>
            )}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: badgeColor,
                border: `1px solid ${badgeColor}`,
                padding: '2px 6px',
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#94a3b8',
                border: '1px solid #334155',
                padding: '2px 6px',
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
            fontWeight: 'bold',
            color: '#f1f5f9',
            lineHeight: 1.3,
          }}
        >
          {post.title}
        </h3>

        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '13px',
            color: '#64748b',
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
            color: '#64748b',
          }}
        >
          <span>
            <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
              {post.author_display_name}
            </span>
            <span style={{ margin: '0 8px', color: '#334155' }}>&middot;</span>
            {timeAgo(post.created_at)}
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="ChartBar" size={13} color="#64748b" />
              <span style={{ color: post.view_count > 1000 ? '#b8ff3d' : '#94a3b8' }}>
                {post.view_count > 1000
                  ? `${(post.view_count / 1000).toFixed(1)}k`
                  : post.view_count}
              </span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Icon name="MessageCircle" size={13} color="#64748b" />
              <span style={{ color: '#94a3b8' }}>{post.comment_count}</span>
            </span>
          </span>
        </div>
      </article>
    </Link>
  );
}
