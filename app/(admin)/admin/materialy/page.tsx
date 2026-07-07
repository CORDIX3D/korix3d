'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
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
import { Box, Edit, ImagePlus, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Material, MaterialColor } from '@/lib/types/database';
import { toast } from 'sonner';
import { OptimizedImage } from '@/components/ui/optimized-image';

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
  const [colors, setColors] = useState<MaterialColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_per_kg: '',
    image_url: '',
    print_temp_min: '',
    print_temp_max: '',
    bed_temp_min: '',
    bed_temp_max: '',
    color_name: '',
    color_hex: '#22c55e',
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
    const [materialsResult, colorsResult] = await Promise.all([
      supabase.from('materials').select('*').order('name'),
      supabase.from('material_colors').select('*').order('created_at'),
    ]);
    if (materialsResult.error || colorsResult.error) toast.error('Błąd', { description: 'Nie udało się pobrać materiałów i kolorów' });
    else {
      setMaterials((materialsResult.data || []) as Material[]);
      setColors((colorsResult.data || []) as MaterialColor[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setEditingMaterial(null);
    setImageFile(null);
    setImagePreview('');
    setFormData({
      name: '',
      description: '',
      price_per_kg: '',
      image_url: '',
      print_temp_min: '',
      print_temp_max: '',
      bed_temp_min: '',
      bed_temp_max: '',
      color_name: '',
      color_hex: '#22c55e',
    });
  };

  const openEditDialog = (material: Material) => {
    const materialColor = colors.find((color) => color.material_id === material.id);
    setEditingMaterial(material);
    setImageFile(null);
    setImagePreview(material.image_url || '');
    setFormData({
      name: material.name,
      description: material.description || '',
      price_per_kg: material.price_per_kg?.toString() || '',
      image_url: material.image_url || '',
      print_temp_min: material.print_temp_min?.toString() || '',
      print_temp_max: material.print_temp_max?.toString() || '',
      bed_temp_min: material.bed_temp_min?.toString() || '',
      bed_temp_max: material.bed_temp_max?.toString() || '',
      color_name: materialColor?.name || '',
      color_hex: materialColor?.hex || '#22c55e',
    });
    setDialogOpen(true);
  };

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return void toast.error('Wybierz plik graficzny');
    if (file.size > 5 * 1024 * 1024) return void toast.error('Zdjęcie może mieć maksymalnie 5 MB');
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview('');
    setFormData((current) => ({ ...current, image_url: '' }));
  };

  const uploadImage = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `materials/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
    if (error) throw error;
    return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
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

    setSaving(true);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : formData.image_url.trim() || null;
      const data = {
        name,
        slug: editingMaterial?.slug || slugify(name),
        description: formData.description.trim() || null,
        price_per_kg: pricePerKg,
        image_url: imageUrl,
        print_temp_min: optionalNumber(formData.print_temp_min),
        print_temp_max: optionalNumber(formData.print_temp_max),
        bed_temp_min: optionalNumber(formData.bed_temp_min),
        bed_temp_max: optionalNumber(formData.bed_temp_max),
        available: true,
        updated_at: new Date().toISOString(),
      };
      let materialId = editingMaterial?.id || '';
      if (editingMaterial) {
        const result = await supabase.from('materials').update(data).eq('id', editingMaterial.id);
        if (result.error) throw result.error;
      } else {
        const result = await supabase.from('materials').insert([data]).select('id').single();
        if (result.error) throw result.error;
        materialId = result.data.id;
      }

      const colorName = formData.color_name.trim();
      const existingColor = colors.find((color) => color.material_id === materialId);
      if (colorName) {
        const colorData = { material_id: materialId, name: colorName, hex: formData.color_hex, available: true };
        const colorResult = existingColor
          ? await supabase.from('material_colors').update(colorData).eq('id', existingColor.id)
          : await supabase.from('material_colors').insert([colorData]);
        if (colorResult.error) throw colorResult.error;
      } else if (existingColor) {
        const colorResult = await supabase.from('material_colors').update({ available: false }).eq('id', existingColor.id);
        if (colorResult.error) throw colorResult.error;
      }
      toast.success(editingMaterial ? 'Materiał zaktualizowany' : 'Materiał dodany do wyceny');
      setDialogOpen(false);
      resetForm();
      fetchMaterials();
    } catch (error) {
      toast.error('Błąd zapisu', { description: error instanceof Error ? error.message : 'Nie udało się zapisać materiału' });
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Materiały i kolory</h1>
          <p className="text-muted-foreground mt-1">Zarządzaj rodzajem materiału, kolorem, zdjęciem, opisem, ceną i parametrami druku w jednym miejscu.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMaterials} variant="outline" size="sm"><RefreshCw className="w-4 h-4 mr-2" />Odśwież</Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild><Button className="bg-gradient-primary hover:shadow-glow"><Plus className="w-4 h-4 mr-2" />Dodaj materiał</Button></DialogTrigger>
            <DialogContent className="bg-card border-border max-w-xl">
              <DialogHeader><DialogTitle>{editingMaterial ? 'Edytuj materiał' : 'Dodaj materiał do wyceny'}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><label className="form-label">Rodzaj materiału *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="PLA, PETG, ABS..." className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Cena z kilograma (zł/kg) *</label><Input type="number" step="0.01" min="0" value={formData.price_per_kg} onChange={(e) => setFormData({ ...formData, price_per_kg: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px]">
                  <div className="space-y-2"><label className="form-label">Kolor</label><Input value={formData.color_name} onChange={(e) => setFormData({ ...formData, color_name: e.target.value })} placeholder="np. Zielony" className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Próbka</label><div className="flex h-11 items-center gap-2 rounded-md border bg-secondary px-2"><Input type="color" value={formData.color_hex} onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })} className="h-8 w-12 cursor-pointer border-0 p-0" /><span className="text-xs text-muted-foreground">{formData.color_hex}</span></div></div>
                </div>
                <div className="space-y-2"><label className="form-label">Opis</label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-foreground" /></div>
                <div className="space-y-2">
                  <label className="form-label">Zdjęcie materiału</label>
                  {imagePreview ? <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                    <OptimizedImage src={imagePreview} alt="Podgląd zdjęcia materiału" className="h-28 w-28 rounded-md border object-cover" sizes="112px" />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" asChild><label className="cursor-pointer"><ImagePlus className="mr-2 h-4 w-4" />Zmień zdjęcie<input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} /></label></Button>
                      <Button type="button" variant="outline" onClick={removeImage}><Trash2 className="mr-2 h-4 w-4" />Usuń</Button>
                    </div>
                  </div> : <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/50">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">Wybierz zdjęcie z urządzenia</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG lub WebP do 5 MB</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleImageChange} />
                  </label>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-2"><label className="form-label">Dysza min °C</label><Input type="number" value={formData.print_temp_min} onChange={(e) => setFormData({ ...formData, print_temp_min: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Dysza max °C</label><Input type="number" value={formData.print_temp_max} onChange={(e) => setFormData({ ...formData, print_temp_max: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Stół min °C</label><Input type="number" value={formData.bed_temp_min} onChange={(e) => setFormData({ ...formData, bed_temp_min: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                  <div className="space-y-2"><label className="form-label">Stół max °C</label><Input type="number" value={formData.bed_temp_max} onChange={(e) => setFormData({ ...formData, bed_temp_max: e.target.value })} className="h-11 bg-secondary border-border" /></div>
                </div>
                <div className="flex gap-3"><Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-gradient-primary hover:shadow-glow">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Zapisywanie...' : editingMaterial ? 'Zapisz zmiany' : 'Dodaj materiał'}</Button><Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Anuluj</Button></div>
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
                <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3">{material.image_url ? <OptimizedImage src={material.image_url} alt={material.name} className="h-12 w-12 rounded-lg object-cover" sizes="48px" /> : <Box className="h-8 w-8 text-primary" />}<div><h3 className="font-semibold text-foreground">{material.name}</h3><p className="text-xs text-muted-foreground">{material.slug}</p></div></div><Badge variant={material.available ? 'default' : 'secondary'}>{material.available ? 'W wycenie' : 'Ukryty'}</Badge></div>
                {colors.filter((color) => color.material_id === material.id && color.available).length > 0 && <div className="flex flex-wrap gap-2">{colors.filter((color) => color.material_id === material.id && color.available).map((color) => <span key={color.id} className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"><span className="h-4 w-4 rounded-full border" style={{ backgroundColor: color.hex }} />{color.name}</span>)}</div>}
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
