import { ImageResponse } from 'next/og';
import { API } from '@/lib/api';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function Image({ params }: { params: { slug: string } }) {
  const slug = String(params.slug);
  let title = '';
  let author = '';
  let category = '';

  try {
    const data = await API.getArticle(slug);
    title = data.article.title;
    author = data.article.author_display_name || data.article.author_username;
    category = data.article.category_name || data.article.category_slug;
  } catch {
    title = slug.replace(/-/g, ' ');
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, #0a0a0f 0%, #0f1a0a 50%, #0a0f1a 100%)',
          color: 'white', padding: 60, fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <span style={{ fontSize: 24, fontWeight: 900, background: 'linear-gradient(135deg, #f97316, #ec4899)', backgroundClip: 'text', color: 'transparent' }}>
            YOTOP10
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, padding: '4px 12px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Article
          </span>
        </div>

        <h1 style={{
          fontSize: 44, fontWeight: 800, lineHeight: 1.2, margin: 0, marginBottom: 20,
          color: '#f4f4f5', letterSpacing: '-0.02em',
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {title}
        </h1>

        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#52525b' }}>
          <span>{author ? `By ${author}` : ''}</span>
          <span>{category}</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
