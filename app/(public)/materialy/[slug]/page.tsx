import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Layers, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { OptimizedImage } from '@/components/ui/optimized-image';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data: material } = await supabase.from('materials').select('name, description').eq('slug', params.slug).eq('available', true).maybeSingle();
  if (!material) notFound();
  return { title: material.name, description: material.description || undefined };
}

export default async function MaterialDetailPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data: material, error } = await supabase.from('materials').select('*').eq('slug', params.slug).eq('available', true).maybeSingle();
  if (error) throw new Error('Nie udało się pobrać materiału.');
  if (!material) notFound();
  const properties = material.properties && typeof material.properties === 'object' && !Array.isArray(material.properties) ? material.properties as Record<string, unknown> : {};

  return <div className="mx-auto min-h-screen max-w-5xl px-4 py-12">
    <Link href="/materialy" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do materiałów</Link>
    <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
      <div className="aspect-square overflow-hidden rounded-2xl bg-primary/10">{material.image_url ? <OptimizedImage src={material.image_url} alt={material.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Layers className="h-24 w-24 text-primary/40" /></div>}</div>
      <div><h1 className="mb-4 text-4xl font-bold">{material.name}</h1><p className="mb-6 text-lg leading-7 text-muted-foreground">{material.description}</p><p className="mb-6 text-3xl font-bold text-primary">{Number(material.price_per_kg).toFixed(2)} zł/kg</p>
        <div className="mb-8 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-secondary p-4"><Thermometer className="mb-2 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Temperatura dyszy</p><p className="font-semibold">{material.print_temp_min || '—'}–{material.print_temp_max || '—'}°C</p></div><div className="rounded-xl bg-secondary p-4"><Thermometer className="mb-2 h-5 w-5 text-primary" /><p className="text-sm text-muted-foreground">Temperatura stołu</p><p className="font-semibold">{material.bed_temp_min || '—'}–{material.bed_temp_max || '—'}°C</p></div></div>
        {Object.keys(properties).length > 0 && <div className="mb-8 rounded-xl border p-5"><h2 className="mb-3 font-semibold">Właściwości</h2><div className="grid gap-2 text-sm text-muted-foreground">{Object.entries(properties).filter(([, value]) => typeof value !== 'object').map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b py-2 last:border-0"><span>{key.replace(/_/g, ' ')}</span><span className="text-foreground">{String(value)}</span></div>)}</div></div>}
        <Button asChild><Link href={`/wycena?material=${material.id}`}>Wyceń wydruk z {material.name}</Link></Button>
      </div>
    </div>
  </div>;
}
