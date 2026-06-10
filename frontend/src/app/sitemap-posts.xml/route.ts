import { absoluteUrl } from '@/lib/urls';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const revalidate = 3600;

export async function GET() {
  const apiBase = process.env.INTERNAL_API_URL || 'http://backend:8000/api';
  let posts: Array<{ slug: string; bumped_at?: string; created_at: string; meta_robots?: string | null }> = [];

  try {
    const res = await fetch(`${apiBase}/posts?limit=1000`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      posts = (data.posts || []).filter((p: { meta_robots?: string | null }) => {
        if (!p.meta_robots) return true;
        return !p.meta_robots.startsWith('noindex');
      });
    }
  } catch { /* sitemap generation must not crash */ }

  const urls = posts.map(p => {
    const lastmod = p.bumped_at || p.created_at;
    const date = lastmod ? new Date(lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return `  <url>
    <loc>${escapeXml(absoluteUrl(p.slug))}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
  });
}
