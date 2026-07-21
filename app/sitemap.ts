import type { MetadataRoute } from 'next';

const SITE_URL = 'https://korix3d.pl';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const pages = [
    { path: '', priority: 1, changeFrequency: 'weekly' as const },
    { path: '/wycena', priority: 0.9, changeFrequency: 'monthly' as const },
    { path: '/sklep', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/portfolio', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/materialy', priority: 0.8, changeFrequency: 'monthly' as const },
    { path: '/blog', priority: 0.8, changeFrequency: 'weekly' as const },
    { path: '/faq', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/kontakt', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/dostawa', priority: 0.5, changeFrequency: 'yearly' as const },
    { path: '/regulamin', priority: 0.4, changeFrequency: 'yearly' as const },
    { path: '/polityka-prywatnosci', priority: 0.4, changeFrequency: 'yearly' as const },
    { path: '/zwroty', priority: 0.4, changeFrequency: 'yearly' as const },
    { path: '/reklamacje', priority: 0.4, changeFrequency: 'yearly' as const },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: SITE_URL + path,
    lastModified,
    changeFrequency,
    priority,
  }));
}
