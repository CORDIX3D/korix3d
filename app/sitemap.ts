import type { MetadataRoute } from 'next';

const SITE_URL = 'https://korix3d.pl';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/wycena', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/sklep', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/materialy', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/blog', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/faq', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/kontakt', priority: 0.7, changeFrequency: 'monthly' as const },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: SITE_URL + path,
    lastModified,
    changeFrequency,
    priority,
  }));
}
