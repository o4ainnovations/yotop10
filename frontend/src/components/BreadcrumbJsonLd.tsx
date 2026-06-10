interface Crumb {
  name: string;
  item: string;
}

export function BreadcrumbJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  if (!crumbs || crumbs.length === 0) return null;
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: c.item,
        })),
      }).replace(/<\//gi, '<\\/'),
    }} />
  );
}
