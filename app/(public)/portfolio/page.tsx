'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Image as ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase/client';
import { PortfolioItem } from '@/lib/types/database';

export default function PortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  useEffect(() => { supabase.from('portfolio_items').select('*').eq('active', true).order('sort_order').then(({ data, error: queryError }: { data: PortfolioItem[] | null; error: unknown }) => { setItems(data || []); setError(Boolean(queryError)); setLoading(false); }); }, []);
  return <div className="min-h-screen"><section className="bg-gradient-to-b from-primary/10 to-transparent py-16 text-center"><h1 className="text-4xl font-bold sm:text-5xl">Portfolio</h1><p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Zobacz wybrane realizacje druku 3D wykonane dla naszych klientów.</p></section><section className="mx-auto max-w-7xl px-4 py-12">{loading ? <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /> : error ? <div className="py-16 text-center"><ImageIcon className="mx-auto mb-4 h-14 w-14 text-destructive" /><h2 className="text-xl font-semibold">Nie udało się pobrać portfolio</h2><p className="mt-2 text-muted-foreground">Odśwież stronę i spróbuj ponownie.</p></div> : items.length ? <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <Link key={item.id} href={`/portfolio/${item.id}`}><Card className="h-full overflow-hidden hover:border-primary/50"><div className="aspect-video bg-secondary">{item.image_url ? <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="h-14 w-14 text-muted-foreground" /></div>}</div><CardContent className="p-5"><h2 className="text-xl font-semibold">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p></CardContent></Card></Link>)}</div> : <div className="py-16 text-center"><ImageIcon className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><h2 className="text-xl font-semibold">Brak opublikowanych realizacji</h2><p className="mt-2 text-muted-foreground">Skontaktuj się z nami, aby poznać przykłady realizacji podobnych do Twojego projektu.</p></div>}</section></div>;
}
