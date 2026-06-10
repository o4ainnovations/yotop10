import { absoluteUrl } from '@/lib/urls';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const revalidate = 3600;

export async function GET() {
  const apiBase = process.env.INTERNAL_API_URL || 'http://backend:8000/api';
  let categories: Array<{ slug: string; name: string; post_count: number }> = [];

  try {
    const res = await fetch(`${apiBase}/categories?include_children=false`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      categories = (data.categories || []).filter((c: { post_count: number }) => c.post_count > 0);
    }
  } catch { /* sitemap generation must not crash */ }

  const urls = categories.map(c => {
    return `  <url>
    <loc>${escapeXml(absoluteUrl(`/c/${c.slug}`))}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
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
