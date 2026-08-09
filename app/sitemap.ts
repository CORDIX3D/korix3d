import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { absoluteSiteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const staticPages = [
  { path: '', priority: 1, changeFrequency: 'weekly' as const },
  { path: '/wycena', priority: 0.9, changeFrequency: 'monthly' as const },
  { path: '/sklep', priority: 0.9, changeFrequency: 'daily' as const },
  { path: '/portfolio', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/materialy', priority: 0.8, changeFrequency: 'monthly' as const },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' as const },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/kontakt', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/aplikacja', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/dostawa', priority: 0.5, changeFrequency: 'yearly' as const },
  { path: '/regulamin', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/polityka-prywatnosci', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/zwroty', priority: 0.4, changeFrequency: 'yearly' as const },
  { path: '/reklamacje', priority: 0.4, changeFrequency: 'yearly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const generatedAt = new Date();
  const entries: MetadataRoute.Sitemap = staticPages.map(({ path, priority, changeFrequency }) => ({
    url: absoluteSiteUrl(path || '/'),
    lastModified: generatedAt,
    changeFrequency,
    priority,
  }));

  try {
    const supabase = await createClient();
    const [products, posts, materials, portfolio] = await Promise.all([
      supabase.from('products').select('slug, updated_at').eq('active', true),
      supabase.from('blog_posts').select('slug, updated_at').eq('published', true),
      supabase.from('materials').select('slug, updated_at').eq('available', true),
      supabase.from('portfolio_items').select('id, created_at').eq('active', true),
    ]);

    if (!products.error) {
      entries.push(...(products.data || []).map((item) => ({
        url: absoluteSiteUrl(`/sklep/${encodeURIComponent(item.slug)}`),
        lastModified: new Date(item.updated_at),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })));
    }
    if (!posts.error) {
      entries.push(...(posts.data || []).map((item) => ({
        url: absoluteSiteUrl(`/blog/${encodeURIComponent(item.slug)}`),
        lastModified: new Date(item.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })));
    }
    if (!materials.error) {
      entries.push(...(materials.data || []).map((item) => ({
        url: absoluteSiteUrl(`/materialy/${encodeURIComponent(item.slug)}`),
        lastModified: new Date(item.updated_at),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })));
    }
    if (!portfolio.error) {
      entries.push(...(portfolio.data || []).map((item) => ({
        url: absoluteSiteUrl(`/portfolio/${item.id}`),
        lastModified: new Date(item.created_at),
        changeFrequency: 'yearly' as const,
        priority: 0.6,
      })));
    }
  } catch {
    // Statyczna część mapy nadal działa, gdy baza jest chwilowo niedostępna.
  }

  return entries;
}
