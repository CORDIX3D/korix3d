import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft, Clock, Image as ImageIcon, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { absoluteSiteUrl, seoDescription, serializeJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PORTFOLIO_ITEM_SELECT = 'id, title, description, image_url, images, material, category, print_time_hours, created_at';

const getPortfolioItem = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('portfolio_items')
    .select(PORTFOLIO_ITEM_SELECT)
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error('Nie udało się pobrać realizacji.');
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const item = await getPortfolioItem(id);
  if (!item) notFound();
  const description = seoDescription(item.description, 'Realizacja druku 3D wykonana przez KORIX3D.');
  const canonical = `/portfolio/${id}`;
  const images = Array.isArray(item.images) ? item.images.filter((image): image is string => typeof image === 'string') : [];
  if (item.image_url) images.unshift(item.image_url);
  return {
    title: item.title,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title: item.title, description, images },
  };
}

export default async function PortfolioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const item = await getPortfolioItem(id);
  if (!item) notFound();
  const images = Array.isArray(item.images) ? item.images as string[] : [];
  const mainImage = item.image_url || images[0];
  const portfolioJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: item.title,
    description: seoDescription(item.description, 'Realizacja druku 3D wykonana przez KORIX3D.'),
    image: mainImage || undefined,
    url: absoluteSiteUrl(`/portfolio/${id}`),
    creator: { '@type': 'Organization', name: 'KORIX3D' },
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(portfolioJsonLd) }} /><div className="mx-auto min-h-screen max-w-6xl px-4 py-12"><Link href="/portfolio" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do portfolio</Link><div className="grid gap-10 lg:grid-cols-2"><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{mainImage ? <OptimizedImage src={mainImage} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-20 w-20 text-muted-foreground" /></div>}</div><div><p className="mb-2 text-sm uppercase tracking-wider text-primary">{item.category}</p><h1 className="mb-5 text-4xl font-bold">{item.title}</h1><p className="mb-8 whitespace-pre-wrap leading-7 text-muted-foreground">{item.description}</p><div className="space-y-3 border-t pt-6">{item.material && <p className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Materiał: {item.material}</p>}{item.print_time_hours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Czas druku: {item.print_time_hours} godz.</p>}</div></div></div></div></>;
}
