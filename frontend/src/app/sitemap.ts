import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/urls';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl('/sitemap-static.xml'), lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: absoluteUrl('/sitemap-posts.xml'), lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: absoluteUrl('/sitemap-articles.xml'), lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: absoluteUrl('/sitemap-categories.xml'), lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
  ];
}
