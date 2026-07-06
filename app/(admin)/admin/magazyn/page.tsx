'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Box, Layers, Package, RefreshCw, Search, ShoppingBag, Weight } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Filament, Material, Product } from '@/lib/types/database';
import { toast } from 'sonner';

type InventoryRow = {
  id: string;
  type: 'Filament' | 'Produkt' | 'Materiał';
  name: string;
  amount: string;
  value: string;
  status: string;
  href: string;
};

export default function AdminWarehousePage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchWarehouse();
  }, []);

  const fetchWarehouse = async () => {
    setLoading(true);
    const [filamentsResult, productsResult, materialsResult] = await Promise.all([
      supabase.from('filaments').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('materials').select('*').order('name'),
    ]);

    if (filamentsResult.error || productsResult.error || materialsResult.error) {
      toast.error('Błąd', { description: 'Nie udało się pobrać danych magazynu' });
    }

    setFilaments((filamentsResult.data || []) as Filament[]);
    setProducts((productsResult.data || []) as Product[]);
    setMaterials((materialsResult.data || []) as Material[]);
    setLoading(false);
  };

  const activeFilaments = filaments.filter((filament) => filament.active !== false);
  const activeProducts = products.filter((product) => product.active !== false);
  const availableMaterials = materials.filter((material) => material.available !== false);
  const totalFilamentWeight = activeFilaments.reduce((sum, filament) => sum + (filament.remaining_weight_grams || 0), 0);
  const lowFilaments = activeFilaments.filter((filament) => filament.remaining_weight_grams <= (filament.min_weight_grams || 100));
  const totalProductStock = activeProducts.reduce((sum, product) => sum + (product.stock_quantity || 0), 0);
  const filamentValue = activeFilaments.reduce((sum, filament) => {
    if (!filament.price_paid || !filament.original_weight_grams) return sum;
    return sum + (filament.price_paid / filament.original_weight_grams) * filament.remaining_weight_grams;
  }, 0);

  const rows = useMemo<InventoryRow[]>(() => {
    const filamentRows = activeFilaments.map((filament) => ({
      id: `filament-${filament.id}`,
      type: 'Filament' as const,
      name: `${filament.brand} ${filament.material_name} ${filament.color}`,
      amount: `${filament.remaining_weight_grams} g`,
      value: filament.price_paid && filament.original_weight_grams
        ? `${((filament.price_paid / filament.original_weight_grams) * filament.remaining_weight_grams).toFixed(2)} zł`
        : '—',
      status: filament.remaining_weight_grams <= (filament.min_weight_grams || 100) ? 'Niski stan' : 'OK',
      href: '/admin/filamenty',
    }));

    const productRows = activeProducts.map((product) => ({
      id: `product-${product.id}`,
      type: 'Produkt' as const,
      name: product.name,
      amount: `${product.stock_quantity} szt.`,
      value: `${(product.price * product.stock_quantity).toFixed(2)} zł`,
      status: product.stock_quantity <= (product.min_stock_quantity || 0) ? 'Niski stan' : 'OK',
      href: '/admin/produkty',
    }));

    const materialRows = availableMaterials.map((material) => ({
      id: `material-${material.id}`,
      type: 'Materiał' as const,
      name: material.name,
      amount: 'do wyceny',
      value: `${material.price_per_kg.toFixed(2)} zł/kg`,
      status: material.available ? 'Dostępny' : 'Ukryty',
      href: '/admin/materialy',
    }));

    return [...filamentRows, ...productRows, ...materialRows];
  }, [activeFilaments, activeProducts, availableMaterials]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => [row.type, row.name, row.amount, row.value, row.status].some((value) => value.toLowerCase().includes(term)));
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Magazyn</h1>
          <p className="text-muted-foreground mt-1">Podgląd filamentów, produktów sklepu i materiałów używanych w wycenie.</p>
        </div>
        <Button onClick={fetchWarehouse} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Odśwież</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><Layers className="w-9 h-9 text-primary" /><div><p className="text-2xl font-bold">{activeFilaments.length}</p><p className="text-sm text-muted-foreground">Szpulek filamentów</p></div></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><Weight className="w-9 h-9 text-blue-400" /><div><p className="text-2xl font-bold">{(totalFilamentWeight / 1000).toFixed(2)} kg</p><p className="text-sm text-muted-foreground">Filamentu w magazynie</p></div></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><ShoppingBag className="w-9 h-9 text-green-400" /><div><p className="text-2xl font-bold">{totalProductStock}</p><p className="text-sm text-muted-foreground">Sztuk produktów</p></div></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="w-9 h-9 text-red-400" /><div><p className="text-2xl font-bold">{lowFilaments.length}</p><p className="text-sm text-muted-foreground">Niskich stanów</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="bg-card border-border"><CardHeader><CardTitle className="text-base">Szybkie akcje</CardTitle></CardHeader><CardContent className="grid gap-3"><Button asChild className="justify-start bg-gradient-primary"><Link href="/admin/filamenty"><Layers className="w-4 h-4 mr-2" />Dodaj filament</Link></Button><Button asChild variant="outline" className="justify-start"><Link href="/admin/produkty"><Package className="w-4 h-4 mr-2" />Dodaj produkt do sklepu</Link></Button><Button asChild variant="outline" className="justify-start"><Link href="/admin/materialy"><Box className="w-4 h-4 mr-2" />Dodaj materiał do wyceny</Link></Button></CardContent></Card>
        <Card className="bg-card border-border lg:col-span-2"><CardHeader><CardTitle className="text-base">Wartość magazynu</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-2xl font-bold">{filamentValue.toFixed(2)} zł</p><p className="text-sm text-muted-foreground">Szacunkowa wartość filamentów</p></div><div><p className="text-2xl font-bold">{availableMaterials.length}</p><p className="text-sm text-muted-foreground">Materiałów do wyceny</p></div><div><p className="text-2xl font-bold">{activeProducts.length}</p><p className="text-sm text-muted-foreground">Produktów w sklepie</p></div></CardContent></Card>
      </div>

      <Card className="bg-card border-border"><CardContent className="p-4"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj w magazynie..." className="pl-12 h-11 bg-secondary border-border" /></div></CardContent></Card>

      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-muted-foreground"><tr><th className="text-left p-3">Typ</th><th className="text-left p-3">Nazwa</th><th className="text-left p-3">Ilość</th><th className="text-left p-3">Wartość / cena</th><th className="text-left p-3">Status</th><th className="text-right p-3">Akcja</th></tr></thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-border"><td className="p-3"><Badge variant="secondary">{row.type}</Badge></td><td className="p-3 font-medium text-foreground">{row.name}</td><td className="p-3 text-muted-foreground">{row.amount}</td><td className="p-3 text-muted-foreground">{row.value}</td><td className="p-3"><Badge variant={row.status === 'OK' || row.status === 'Dostępny' ? 'default' : 'destructive'}>{row.status}</Badge></td><td className="p-3 text-right"><Button asChild size="sm" variant="ghost"><Link href={row.href}>Otwórz</Link></Button></td></tr>
                  ))}
                  {filteredRows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak pozycji magazynowych</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
