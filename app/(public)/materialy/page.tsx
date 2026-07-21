'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Thermometer,
  Layers,
  ShieldCheck,
  Zap,
  Droplets,
  Sun,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Material } from '@/lib/types/database';

const materialProperties = [
  { key: 'strength', label: 'Wytrzymałość', icon: ShieldCheck },
  { key: 'flexibility', label: 'Elastyczność', icon: Layers },
  { key: 'temp_resistance', label: 'Odporność termiczna', icon: Thermometer },
  { key: 'uv_resistance', label: 'Odporność UV', icon: Sun },
  { key: 'water_resistance', label: 'Odporność na wodę', icon: Droplets },
  { key: 'ease_of_print', label: 'Łatwość druku', icon: Zap },
];

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [colors, setColors] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data: materialsData, error: queryError } = await supabase
        .from('materials')
        .select('*')
        .eq('available', true)
        .order('name');

      if (queryError) throw queryError;
      const availableMaterials = (materialsData || []) as Material[];
      setMaterials(availableMaterials);

      const colorResults = await Promise.all(
        availableMaterials.map(async (material) => {
          const { data: materialColors, error: colorsError } = await supabase
            .from('material_colors')
            .select('*')
            .eq('material_id', material.id)
            .eq('available', true);
          return [material.id, colorsError ? [] : materialColors || []] as const;
        })
      );

      setColors(Object.fromEntries(colorResults));
    } catch {
      setMaterials([]);
      setColors({});
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) return <div className="min-h-[60vh] flex items-center justify-center px-4 text-center"><div><Layers className="mx-auto mb-4 h-14 w-14 text-destructive" /><h1 className="text-2xl font-bold">Nie udało się pobrać materiałów</h1><p className="mt-2 text-muted-foreground">Sprawdź połączenie i spróbuj ponownie.</p><Button className="mt-5" variant="outline" onClick={fetchMaterials}>Spróbuj ponownie</Button></div></div>;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-16 bg-gradient-to-b from-primary/10 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Materiały do druku 3D
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Szeroki wybór materiałów dla każdego zastosowania - od prostego PLA po inżynieryjne PA-CF i PC
          </p>
        </div>
      </section>

      {/* Materials Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6">
            {materials.map((material) => (
              <Card
                key={material.id}
                className="bg-card border-border hover:border-primary/50 transition-all overflow-hidden"
              >
                <CardContent className="p-0">
                  {/* Main Header */}
                  <button
                    onClick={() =>
                      setExpandedMaterial(
                        expandedMaterial === material.id ? null : material.id
                      )
                    }
                    className="w-full p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Layers className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">
                          {material.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {material.description}
                        </p>
                      </div>
                    </div>
                    <div className="w-full text-left sm:w-auto sm:text-right">
                      <div className="text-2xl font-bold text-primary">
                        {material.price_per_kg.toFixed(2)} zł/kg
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {colors[material.id]?.length || 0} kolorów
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {expandedMaterial === material.id && (
                    <div className="border-t border-border p-6 bg-secondary/20">
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Left Column - Properties */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            <Info className="w-4 h-4 text-primary" />
                            Parametry druku
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-secondary rounded-xl">
                              <p className="text-sm text-muted-foreground">
                                Temperatura dyszy
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {material.print_temp_min}-{material.print_temp_max}°C
                              </p>
                            </div>
                            <div className="p-4 bg-secondary rounded-xl">
                              <p className="text-sm text-muted-foreground">
                                Temperatura stołu
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {material.bed_temp_min}-{material.bed_temp_max}°C
                              </p>
                            </div>
                          </div>

                          {/* Properties */}
                          {material.properties && (
                            <div className="space-y-3 mt-6">
                              <h4 className="font-semibold text-foreground">
                                Właściwości
                              </h4>
                              {Object.entries(material.properties as Record<string, any>).map(
                                ([key, value]) => (
                                  <div key={key} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                                    <span className="text-sm text-muted-foreground capitalize">
                                      {key.replace(/_/g, ' ')}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className="w-24 h-2 bg-border rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary rounded-full"
                                          style={{ width: `${(value as number) * 20}%` }}
                                        />
                                      </div>
                                      <span className="text-sm font-medium text-foreground w-8">
                                        {value}/5
                                      </span>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Column - Advantages & Colors */}
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-400" />
                              Zalety
                            </h4>
                            <div className="space-y-2">
                              {(material.properties as any)?.advantages?.map(
                                (adv: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                  >
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    {adv}
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-400" />
                              Wady
                            </h4>
                            <div className="space-y-2">
                              {(material.properties as any)?.disadvantages?.map(
                                (dis: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                  >
                                    <XCircle className="w-4 h-4 text-red-400" />
                                    {dis}
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          {/* Available Colors */}
                          {colors[material.id]?.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-foreground mb-3">
                                Dostępne kolory
                              </h4>
                              <div className="flex flex-wrap gap-2">
                                {colors[material.id].map((color) => (
                                  <div
                                    key={color.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg"
                                  >
                                    <div
                                      className="w-4 h-4 rounded-full border border-border"
                                      style={{ backgroundColor: color.hex }}
                                    />
                                    <span className="text-sm text-foreground">
                                      {color.name}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Link href={`/wycena?material=${material.id}`}>
                            <button className="w-full mt-4 px-6 py-3 bg-gradient-primary text-white rounded-xl font-medium hover:shadow-glow transition-shadow">
                              Zamów wydruk z {material.name}
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-16 bg-card/50 border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Nie wiesz, jaki materiał wybrać?
          </h2>
          <p className="text-muted-foreground mb-8">
            Nasi specjaliści pomogą Ci dobrać najlepszy materiał dla Twojego projektu.
            Skontaktuj się z nami - doradztwo jest bezpłatne!
          </p>
          <Link
            href="/kontakt"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-primary text-white rounded-xl font-medium hover:shadow-glow transition-shadow"
          >
            Skontaktuj się z nami
          </Link>
        </div>
      </section>
    </div>
  );
}
