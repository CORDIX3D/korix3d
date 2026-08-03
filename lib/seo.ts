export const SITE_URL = 'https://korix3d.pl';

export function absoluteSiteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function seoDescription(value: string | null | undefined, fallback: string) {
  const normalized = String(value || fallback).replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 200);
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteSiteUrl(item.path),
    })),
  };
}
