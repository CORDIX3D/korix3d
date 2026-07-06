'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Box, Edit, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Material } from '@/lib/types/database';
import { toast } from 'sonner';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `material-${Date.now()}`;

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_kg: '',
    image_url: '',
    print_temp_min: '',
    print_temp_max: '',
    bed_temp_min: '',
    bed_temp_max: '',
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return materials;
    return materials.filter((material) =>
      [material.name, material.description || ''].some((value) => value.toLowerCase().includes(term))
    );
  }, [materials, search]);

  const fetchMaterials = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('materials').select('*').order('name');
    if (error) toast.error('Błąd', { description: 'Nie udało się pobrać materiałów' });
    else if (data) setMaterials(data as Material[]);
    setLoading(false);
  };

  const resetForm = () => {
    setEditingMaterial(null);
    setFormData({
      name: '',
      description: '',
      price_per_kg: '',
      image_url: '',
      print_temp_min: '',
      print_temp_max: '',
      bed_temp_min: '',
      bed_temp_max: '',
    });
  };

  const openEditDialog = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      description: material.description || '',
      price_per_kg: material.price_per_kg?.toString() || '',
      image_url: material.image_url || '',
      print_temp_min: material.print_temp_min?.toString() || '',
      print_temp_max: material.print_temp_max?.toString() || '',
      bed_temp_min: material.bed_temp_min?.toString() || '',
      bed_temp_max: material.bed_temp_max?.toString() || '',
    });
    setDialogOpen(true);
  };

  const optionalNumber = (value: string) => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const pricePerKg = Number(formData.price_per_kg);
    if (!name || !Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      toast.error('Uzupełnij nazwę i cenę z kilograma');
      return;
    }

    const data = {
      name,
      slug: editingMaterial?.slug || slugify(name),
      description: formData.description.trim() || null,
      price_per_kg: pricePerKg,
      image_url: formData.image_url.trim() || null,
      print_temp_min: optionalNumber(formData.print_temp_min),
      print_temp_max: optionalNumber(formData.print_temp_max),
      bed_temp_min: optionalNumber(formData.bed_temp_min),
      bed_temp_max: optionalNumber(formData.bed_temp_max),
      available: true,
      updated_at: new Date().toISOString(),
    };

    const result = editingMaterial
      ? await supabase.from('materials').update(data).eq('id', editingMaterial.id)
      : await supabase.from('materials').insert([data]);

    if (result.error) {
      toast.error('Błąd zapisu', { description: result.error.message });
      return;
    }
    toast.success(editingMaterial ? 'Materiał zaktualizowany' : 'Materiał dodany do wyceny');
    setDialogOpen(false);
    resetForm();
    fetchMaterials();
  };

  const toggleAvailable = async (material: Material) => {
    const { error } = await supabase
      .from('materials')
      .update({ available: !material.available, updated_at: new Date().toISOString() })
      .eq('id', material.id);
    if (error) toast.error('Nie udało się zmienić dostępności');
    else fetchMaterials();
  };

  const hideMaterial = async (material: Material) => {
    const { error } = await supabase
      .from('materials')
      .update({ available: false, updated_at: new Date().toISOString() })
      .eq('id', material.id);
    if (error) toast.error('Nie udało się ukryć materiału');
    else {
      toast.success('Materiał ukryty w wycenie');
      fetchMaterials();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Materiały do wyceny</h1>
          <p className="text-muted-foreground mt-1">Dodawaj materiały i cenę z kilograma używaną w formularzu wyceny.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMaterials} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Odśwież</Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button className="bg-gradient-primary hover:shadow-glow"><Plus className="w-4 h-4 mr-2" />Dodaj materiał</Button></DialogTrigger>
            <DialogContent className="bg-card border-border max-w-xl">
              <DialogHeader><DialogTitle>{editingMaterial ? 'Edytuj materiał' : 'Dodaj materiał do wyceny'}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="form-label">Nazwa *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="PLA, PETG, ABS..." className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Cena z kilograma (zł/kg) *</label><Input type="number" step="0.01" min="0" value={formData.price_per_kg} onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                </div>
                <div className="space-y-2"><label className="form-label">Opis</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-foreground" /></div>
                <div className="space-y-2"><label className="form-label">Zdjęcie materiału - URL</label><Input value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} placeholder="https://..." className="h-11 bg-secondary border-border" /></div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-2"><label className="form-label">Dysza min °C</label><Input type="number" value={formData.print_temp_min} onChange={(e) => setFormData({ ...formData, print_temp_min: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Dysza max °C</label><Input type="number" value={formData.print_temp_max} onChange={(e) => setFormData({ ...formData, print_temp_max: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Stół min °C</label><Input type="number" value={formData.bed_temp_min} onChange={(e) => setFormData({ ...formData, bed_temp_min: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Stół max °C</label><Input type="number" value={formData.bed_temp_max} onChange={(e) => setFormData({ ...formData, bed_temp_max: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                </div>
                <div className="flex gap-3"><Button onClick={handleSubmit} className="flex-1 bg-gradient-primary hover:shadow-glow">{editingMaterial ? 'Zapisz zmiany' : 'Dodaj materiał'}</Button><Button variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-2xl font-bold">{materials.length}</p><p className="text-sm text-muted-foreground">Wszystkich materiałów</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-2xl font-bold">{materials.filter((m) => m.available).length}</p><p className="text-sm text-muted-foreground">Dostępnych w wycenie</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-2xl font-bold">{materials.length ? (materials.reduce((sum, m) => sum + (m.price_per_kg || 0), 0) / materials.length).toFixed(2) : '0.00'} zł</p><p className="text-sm text-muted-foreground">Średnia cena/kg</p></CardContent></Card>
      </div>

      <Card className="bg-card border-border"><CardContent className="p-4"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj materiału..." className="pl-12 h-11 bg-secondary border-border" /></div></CardContent></Card>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><Box className="w-8 h-8 text-primary" /><div><h3 className="font-semibold text-foreground">{material.name}</h3><p className="text-xs text-muted-foreground">{material.slug}</p></div></div><Badge variant={material.available ? 'default' : 'secondary'}>{material.available ? 'W wycenie' : 'Ukryty'}</Badge></div>
                {material.description && <p className="text-sm text-muted-foreground line-clamp-3">{material.description}</p>}
                <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Cena z kilograma</span><span className="font-semibold text-foreground">{material.price_per_kg.toFixed(2)} zł/kg</span></div>
                <div className="text-sm text-muted-foreground">Dysza: {material.print_temp_min || '—'}-{material.print_temp_max || '—'}°C • Stół: {material.bed_temp_min || '—'}-{material.bed_temp_max || '—'}°C</div>
                <div className="flex gap-2 pt-2"><Button size="sm" variant="outline" onClick={() => openEditDialog(material)} className="flex-1"><Edit className="w-4 h-4 mr-1" />Edytuj</Button><Button size="sm" variant="outline" onClick={() => toggleAvailable(material)}>{material.available ? 'Ukryj' : 'Pokaż'}</Button><Button size="sm" variant="ghost" onClick={() => hideMaterial(material)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
