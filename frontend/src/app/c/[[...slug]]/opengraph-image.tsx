import { ImageResponse } from 'next/og';
import { API } from '@/lib/api';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: { slug?: string[] } }) {
  const slug = (params.slug || []).join('/') || 'uncategorized';
  let name = slug.replace(/\//g, ' / ').replace(/-/g, ' ');
  let postCount = 0;

  try {
    const catData = await API.getCategory(slug) as { category?: { name: string; post_count: number } };
    if (catData.category) {
      name = catData.category.name;
      postCount = catData.category.post_count;
    }
  } catch { /* fallback to slug */ }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1a2a 50%, #0a0a0f 100%)',
          color: 'white', padding: 60, fontFamily: 'system-ui, sans-serif', textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 24, fontWeight: 900, background: 'linear-gradient(135deg, #f97316, #ec4899)', backgroundClip: 'text', color: 'transparent' }}>
            YOTOP10
          </span>
        </div>

        <span style={{
          fontSize: 14, fontWeight: 700, padding: '4px 16px', borderRadius: 6,
          background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)',
          color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
        }}>
          Category
        </span>

        <h1 style={{ fontSize: 64, fontWeight: 900, margin: 0, marginBottom: 12, color: '#f4f4f5', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
          {name}
        </h1>

        {postCount > 0 && (
          <p style={{ fontSize: 20, color: '#a1a1aa', margin: 0 }}>
            {postCount} {postCount === 1 ? 'post' : 'posts'}
          </p>
        )}
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
