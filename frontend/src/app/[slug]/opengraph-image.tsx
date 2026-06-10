import { ImageResponse } from 'next/og';
import { API } from '@/lib/api';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: { slug: string } }) {
  const slug = String(params.slug);
  let title = '';
  let topItems: Array<{ rank: number; title: string }> = [];
  let category = '';
  let postType = '';

  try {
    const data = await API.getPost(slug);
    title = data.post.title;
    topItems = (data.items || []).slice(0, 3);
    category = data.post.category_name || data.post.category_slug;
    postType = data.post.post_type;
  } catch {
    title = slug.replace(/-/g, ' ');
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a0a 50%, #0f0a1a 100%)',
          color: 'white',
          padding: 60,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 24, fontWeight: 900, background: 'linear-gradient(135deg, #f97316, #ec4899)', backgroundClip: 'text', color: 'transparent' }}>
            YOTOP10
          </span>
        </div>

        {/* Type badge */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          {postType && (
            <span style={{
              fontSize: 14, fontWeight: 700, padding: '4px 12px', borderRadius: 6,
              background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)',
              color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {postType === 'top_list' ? 'Ranked List' : postType === 'this_vs_that' ? 'Debate' : postType === 'fact_drop' ? 'Fact' : postType === 'best_of' ? 'Best Of' : postType === 'worst_of' ? 'Worst Of' : postType.replace(/_/g, ' ')}
            </span>
          )}
          {category && (
            <span style={{
              fontSize: 14, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#a1a1aa',
            }}>
              {category}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 48, fontWeight: 800, lineHeight: 1.15, margin: 0, marginBottom: 24,
          color: '#f4f4f5', letterSpacing: '-0.02em', overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
        }}>
          {title}
        </h1>

        {/* Top items */}
        {topItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
            {topItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, fontFamily: 'monospace',
                  background: 'rgba(249, 115, 22, 0.15)', color: '#f97316',
                }}>
                  {item.rank}
                </span>
                <span style={{ fontSize: 20, color: '#d4d4d8', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{
          marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#52525b',
        }}>
          <span>YoTop10 — Fact Mine. Debate Ground.</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
