import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Image as ImageIcon, Layers } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { OptimizedImage } from '@/components/ui/optimized-image';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data: item } = await supabase.from('portfolio_items').select('title, description').eq('id', params.id).eq('active', true).maybeSingle();
  if (!item) notFound();
  return { title: item.title, description: item.description || undefined };
}

export default async function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: item, error } = await supabase.from('portfolio_items').select('*').eq('id', params.id).eq('active', true).maybeSingle();
  if (error) throw new Error('Nie udało się pobrać realizacji.');
  if (!item) notFound();
  const images = Array.isArray(item.images) ? item.images as string[] : [];
  const mainImage = item.image_url || images[0];

  return <div className="mx-auto min-h-screen max-w-6xl px-4 py-12"><Link href="/portfolio" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do portfolio</Link><div className="grid gap-10 lg:grid-cols-2"><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{mainImage ? <OptimizedImage src={mainImage} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-20 w-20 text-muted-foreground" /></div>}</div><div><p className="mb-2 text-sm uppercase tracking-wider text-primary">{item.category}</p><h1 className="mb-5 text-4xl font-bold">{item.title}</h1><p className="mb-8 whitespace-pre-wrap leading-7 text-muted-foreground">{item.description}</p><div className="space-y-3 border-t pt-6">{item.material && <p className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Materiał: {item.material}</p>}{item.print_time_hours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Czas druku: {item.print_time_hours} godz.</p>}</div></div></div></div>;
}
