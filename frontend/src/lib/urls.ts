const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://yotop10.com';

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function postUrl(slug: string): string {
  return absoluteUrl(`/${slug}`);
}

export function articleUrl(slug: string): string {
  return absoluteUrl(`/articles/${slug}`);
}

export function categoryUrl(slug: string): string {
  return absoluteUrl(`/c/${slug}`);
}

export function profileUrl(username: string): string {
  return absoluteUrl(`/a/${username}`);
}
