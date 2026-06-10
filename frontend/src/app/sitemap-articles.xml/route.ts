import { absoluteUrl } from '@/lib/urls';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const revalidate = 3600;

export async function GET() {
  const apiBase = process.env.INTERNAL_API_URL || 'http://backend:8000/api';
  let articles: Array<{ slug: string; updated_at?: string; created_at: string }> = [];

  try {
    const res = await fetch(`${apiBase}/articles?limit=1000`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      articles = data.articles || [];
    }
  } catch { /* sitemap generation must not crash */ }

  const urls = articles.map(a => {
    const lastmod = a.updated_at || a.created_at;
    const date = lastmod ? new Date(lastmod).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    return `  <url>
    <loc>${escapeXml(absoluteUrl(`/articles/${a.slug}`))}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
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
