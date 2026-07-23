'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Palette, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Filament, Material } from '@/lib/types/database';

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const filamentsByMaterial = useMemo(() => {
    return filaments.reduce<Record<string, Filament[]>>((acc, filament) => {
      const key = filament.material_id || filament.material_name;
      acc[key] = acc[key] || [];
      acc[key].push(filament);
      return acc;
    }, {});
  }, [filaments]);

  const fetchData = async () => {
    setLoading(true);
    setError('');

    try {
      const [materialsResult, filamentsResult] = await Promise.all([
        supabase.from('materials').select('*').eq('available', true).order('name'),
        supabase
          .from('filaments')
          .select('*')
          .eq('active', true)
          .gt('remaining_weight_grams', 0)
          .order('material_name')
          .order('color'),
      ]);

      if (materialsResult.error || filamentsResult.error) {
        throw materialsResult.error || filamentsResult.error;
      }

      setMaterials((materialsResult.data || []) as Material[]);
      setFilaments((filamentsResult.data || []) as Filament[]);
    } catch {
      setMaterials([]);
      setFilaments([]);
      setError('Nie udało się pobrać materiałów i dostępnych filamentów.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 text-center">
        <div>
          <Layers className="mx-auto mb-4 h-14 w-14 text-destructive" />
          <h1 className="text-2xl font-bold">Nie udało się pobrać materiałów</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <Button className="mt-5" variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Spróbuj ponownie
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative bg-gradient-to-b from-primary/10 to-transparent py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-foreground sm:text-5xl">
            Materiały do druku 3D
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Wybierz rodzaj materiału, a kolor i konkretny filament dobierzemy z aktualnego magazynu.
          </p>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {materials.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="p-10 text-center">
                <Layers className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-medium text-foreground">Brak aktywnych materiałów</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Dodaj typy materiałów w panelu administratora, np. PLA, PETG albo ABS.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {materials.map((material) => {
                const materialFilaments = filamentsByMaterial[material.id] || filamentsByMaterial[material.name] || [];
                return (
                  <Card key={material.id} className="overflow-hidden border-border bg-card transition-all hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Layers className="h-8 w-8 text-primary" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-foreground">{material.name}</h2>
                            <p className="mt-2 max-w-3xl text-muted-foreground">
                              {material.description || 'Typ materiału dostępny do indywidualnej wyceny druku 3D.'}
                            </p>
                          </div>
                        </div>
                        <Button asChild className="bg-gradient-primary hover:shadow-glow">
                          <Link href={`/wycena?material=${material.id}`}>Wyceń wydruk</Link>
                        </Button>
                      </div>

                      <div className="mt-6 border-t border-border pt-5">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                          <Palette className="h-4 w-4 text-primary" />
                          Dostępne filamenty i kolory
                        </div>
                        {materialFilaments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {materialFilaments.map((filament) => (
                              <Badge key={filament.id} variant="secondary" className="gap-2 px-3 py-1.5">
                                <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: filament.color_hex || '#ffffff' }} />
                                {filament.color}
                                {filament.brand ? ` · ${filament.brand}` : ''}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Brak aktywnych filamentów tego typu w magazynie. Możesz nadal wysłać zapytanie — potwierdzimy dostępność ręcznie.
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="border-t border-border bg-card/50 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="mb-4 text-2xl font-bold text-foreground">Nie wiesz, jaki materiał wybrać?</h2>
          <p className="mb-8 text-muted-foreground">
            Opisz zastosowanie elementu w formularzu wyceny. Dobierzemy materiał, kolor i ustawienia druku do projektu.
          </p>
          <Button asChild className="bg-gradient-primary hover:shadow-glow">
            <Link href="/wycena">Przejdź do wyceny</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
