'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Image as ImageIcon, Layers } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { PortfolioItem } from '@/lib/types/database';

export default function PortfolioDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<PortfolioItem | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.from('portfolio_items').select('*').eq('id', params.id).eq('active', true).maybeSingle().then(({ data }: { data: PortfolioItem | null }) => { setItem(data); setLoading(false); }); }, [params.id]);
  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!item) return <div className="min-h-[60vh] flex items-center justify-center text-center"><div><ImageIcon className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><h1 className="text-2xl font-bold">Nie znaleziono realizacji</h1><Link href="/portfolio" className="mt-5 inline-block text-primary">Wróć do portfolio</Link></div></div>;
  const images = Array.isArray(item.images) ? item.images as string[] : []; const mainImage = item.image_url || images[0];
  return <div className="mx-auto min-h-screen max-w-6xl px-4 py-12"><Link href="/portfolio" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do portfolio</Link><div className="grid gap-10 lg:grid-cols-2"><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{mainImage ? <img src={mainImage} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-20 w-20 text-muted-foreground" /></div>}</div><div><p className="mb-2 text-sm uppercase tracking-wider text-primary">{item.category}</p><h1 className="mb-5 text-4xl font-bold">{item.title}</h1><p className="mb-8 whitespace-pre-wrap leading-7 text-muted-foreground">{item.description}</p><div className="space-y-3 border-t pt-6">{item.material && <p className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />Materiał: {item.material}</p>}{item.print_time_hours && <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Czas druku: {item.print_time_hours} godz.</p>}</div></div></div></div>;
}
