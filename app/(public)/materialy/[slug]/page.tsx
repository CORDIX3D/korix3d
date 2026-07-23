import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Layers, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data: material } = await supabase
    .from('materials')
    .select('name, description')
    .eq('slug', params.slug)
    .eq('available', true)
    .maybeSingle();

  if (!material) notFound();

  return { title: material.name, description: material.description || undefined };
}

export default async function MaterialDetailPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data: material, error } = await supabase
    .from('materials')
    .select('id, name, description')
    .eq('slug', params.slug)
    .eq('available', true)
    .maybeSingle();

  if (error) throw new Error('Nie udało się pobrać materiału.');
  if (!material) notFound();

  const { data: filaments } = await supabase
    .from('filaments')
    .select('id, brand, color, color_hex, remaining_weight_grams')
    .eq('material_id', material.id)
    .eq('active', true)
    .gt('remaining_weight_grams', 0)
    .order('color');

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-12">
      <Link href="/materialy" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Wróć do materiałów
      </Link>

      <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
        <div className="flex aspect-square items-center justify-center rounded-2xl bg-primary/10">
          <Layers className="h-24 w-24 text-primary/40" />
        </div>
        <div>
          <h1 className="mb-4 text-4xl font-bold">{material.name}</h1>
          <p className="mb-8 text-lg leading-7 text-muted-foreground">
            {material.description || 'Typ materiału dostępny do indywidualnej wyceny druku 3D.'}
          </p>

          <div className="mb-8 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Palette className="h-5 w-5 text-primary" />
              Dostępne filamenty i kolory
            </h2>
            {filaments && filaments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filaments.map((filament) => (
                  <Badge key={filament.id} variant="secondary" className="gap-2 px-3 py-1.5">
                    <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: filament.color_hex || '#ffffff' }} />
                    {filament.color}
                    {filament.brand ? ` · ${filament.brand}` : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Brak aktywnych filamentów tego typu w magazynie. Potwierdzimy dostępność po przesłaniu zapytania.
              </p>
            )}
          </div>

          <Button asChild className="bg-gradient-primary hover:shadow-glow">
            <Link href={`/wycena?material=${material.id}`}>Wyceń wydruk z {material.name}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
