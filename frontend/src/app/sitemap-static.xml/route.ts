import { absoluteUrl } from '@/lib/urls';

const STATIC_PAGES = [
  { path: '/', priority: 1.0, freq: 'daily' as const },
  { path: '/arguments', priority: 0.9, freq: 'hourly' as const },
  { path: '/categories', priority: 0.8, freq: 'weekly' as const },
  { path: '/explore', priority: 0.7, freq: 'daily' as const },
  { path: '/submit', priority: 0.5, freq: 'monthly' as const },
  { path: '/submit-article', priority: 0.5, freq: 'monthly' as const },
  { path: '/saved', priority: 0.3, freq: 'never' as const },
  { path: '/notifications', priority: 0.3, freq: 'never' as const },
];

export async function GET() {
  const urls = STATIC_PAGES.map(
    p => `  <url>
    <loc>${absoluteUrl(p.path)}</loc>
    <priority>${p.priority}</priority>
    <changefreq>${p.freq}</changefreq>
  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
  });
}
