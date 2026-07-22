'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Material } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';
import { Box, Edit, Loader2, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingMaterialId, setTogglingMaterialId] = useState<string | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
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
    setLoadError('');

    try {
      const { data, error } = await supabase.from('materials').select('*').order('name');

      if (error) {
        setLoadError('Nie udało się pobrać typów materiałów z Supabase.');
        setMaterials([]);
        toast.error('Błąd', { description: 'Nie udało się pobrać typów materiałów' });
      } else {
        setMaterials((data || []) as Material[]);
      }
    } catch {
      setLoadError('Nie udało się połączyć z Supabase podczas pobierania typów materiałów.');
      setMaterials([]);
      toast.error('Błąd', { description: 'Nie udało się połączyć z Supabase' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingMaterial(null);
    setFormData({ name: '', description: '' });
  };

  const openEditDialog = (material: Material) => {
    setEditingMaterial(material);
    setFormData({
      name: material.name,
      description: material.description || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (saving) return;

    const name = formData.name.trim().toUpperCase();
    if (!name) {
      toast.error('Podaj rodzaj materiału', { description: 'Np. PLA, PETG, ABS, ASA albo TPU.' });
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      if (editingMaterial) payload.set('id', editingMaterial.id);
      payload.set('name', name);
      payload.set('description', formData.description.trim());

      const response = await fetch('/api/admin/materials', { method: 'POST', body: payload });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Nie udało się zapisać typu materiału');

      toast.success(editingMaterial ? 'Typ materiału zaktualizowany' : 'Typ materiału dodany');
      setDialogOpen(false);
      resetForm();
      fetchMaterials();
    } catch (error) {
      toast.error('Błąd zapisu', {
        description: error instanceof Error ? error.message : 'Nie udało się zapisać typu materiału',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailable = async (material: Material) => {
    if (togglingMaterialId) return;

    setTogglingMaterialId(material.id);
    try {
      const { error } = await supabase
        .from('materials')
        .update({ available: !material.available, updated_at: new Date().toISOString() })
        .eq('id', material.id);

      if (error) {
        toast.error('Nie udało się zmienić dostępności typu materiału');
      } else {
        fetchMaterials();
      }
    } catch {
      toast.error('Nie udało się połączyć z Supabase podczas zmiany dostępności');
    } finally {
      setTogglingMaterialId(null);
    }
  };

  const deleteMaterial = async (material: Material) => {
    if (deletingMaterialId) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć typ materiału „${material.name}”?`)) return;

    setDeletingMaterialId(material.id);
    try {
      const { error } = await supabase.from('materials').delete().eq('id', material.id);

      if (error) {
        toast.error('Nie udało się usunąć typu materiału', { description: error.message });
        return;
      }

      toast.success('Typ materiału został usunięty');
      fetchMaterials();
    } catch {
      toast.error('Nie udało się połączyć z Supabase podczas usuwania typu materiału');
    } finally {
      setDeletingMaterialId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Materiały</h1>
          <p className="mt-1 text-muted-foreground">
            Prosty słownik rodzajów materiału używany w wycenie, np. PLA, PETG, ABS, ASA, TPU.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchMaterials} disabled={loading} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Odśwież
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:shadow-glow">
                <Plus className="mr-2 h-4 w-4" />
                Dodaj materiał
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg border-border bg-card">
              <DialogHeader>
                <DialogTitle>{editingMaterial ? 'Edytuj typ materiału' : 'Dodaj typ materiału'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="form-label">Rodzaj materiału *</label>
                  <Input
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder="PLA, PETG, ABS..."
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Opis dla klienta</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    className="h-24 w-full rounded-lg border border-border bg-secondary p-3 text-foreground"
                    placeholder="Krótko: do czego pasuje ten materiał i kiedy go polecać."
                  />
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)} className="sm:w-auto">
                    Anuluj
                  </Button>
                  <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-gradient-primary hover:shadow-glow">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Zapisywanie...' : editingMaterial ? 'Zapisz zmiany' : 'Dodaj materiał'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{materials.length}</p>
            <p className="text-sm text-muted-foreground">Wszystkich typów</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{materials.filter((material) => material.available).length}</p>
            <p className="text-sm text-muted-foreground">Aktywnych w wycenie</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{materials.filter((material) => !material.available).length}</p>
            <p className="text-sm text-muted-foreground">Ukrytych</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Szukaj typu materiału..."
              className="h-11 bg-secondary pl-12 border-border"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : loadError ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-8 text-center">
            <p className="font-medium text-destructive">Nie udało się pobrać typów materiałów.</p>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
            <Button className="mt-5" variant="outline" onClick={fetchMaterials}>Spróbuj ponownie</Button>
          </CardContent>
        </Card>
      ) : filteredMaterials.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <Box className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="font-medium text-foreground">{search.trim() ? 'Brak materiałów dla tej frazy' : 'Brak typów materiałów'}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {search.trim() ? 'Zmień wyszukiwanie albo wyczyść filtr.' : 'Dodaj pierwszy typ materiału, np. PLA.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => (
            <Card key={material.id} className="bg-card border-border">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{material.name}</h3>
                    <p className="text-xs text-muted-foreground">{material.slug}</p>
                  </div>
                  <Badge variant={material.available ? 'default' : 'secondary'}>
                    {material.available ? 'Aktywny' : 'Ukryty'}
                  </Badge>
                </div>
                {material.description ? (
                  <p className="text-sm text-muted-foreground line-clamp-3">{material.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Brak opisu.</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEditDialog(material)} disabled={togglingMaterialId === material.id || deletingMaterialId === material.id} className="flex-1">
                    <Edit className="mr-1 h-4 w-4" />
                    Edytuj
                  </Button>
                  <Button size="sm" variant="outline" disabled={togglingMaterialId === material.id || deletingMaterialId === material.id} onClick={() => toggleAvailable(material)}>
                    {togglingMaterialId === material.id ? 'Zapisywanie...' : material.available ? 'Ukryj' : 'Pokaż'}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={deletingMaterialId === material.id} aria-label={`Usuń typ materiału ${material.name}`} title="Usuń" onClick={() => deleteMaterial(material)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
