'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  Layers,
  Droplet,
  Box,
  Weight,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Filament, Material } from '@/lib/types/database';
import { toast } from 'sonner';

export default function AdminFilamentsPage() {
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFilament, setEditingFilament] = useState<Filament | null>(null);
  const [formData, setFormData] = useState({
    brand: '',
    material_id: '',
    material_name: '',
    color: '',
    color_hex: '#FFFFFF',
    original_weight_grams: '1000',
    remaining_weight_grams: '1000',
    price_paid: '',
    min_weight_grams: '100',
    location: '',
    notes: '',
  });

  useEffect(() => {
    fetchFilaments();
    fetchMaterials();
  }, []);

  const fetchFilaments = async () => {
    setLoading(true);
    let query = supabase
      .from('filaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`brand.ilike.%${search}%,material_name.ilike.%${search}%,color.ilike.%${search}%`);
    }

    const { data } = await query;
    if (data) setFilaments(data as Filament[]);
    setLoading(false);
  };

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from('materials')
      .select('*')
      .eq('available', true)
      .order('name');

    if (data) setMaterials(data as Material[]);
  };

  const handleSubmit = async () => {
    const data = {
      brand: formData.brand,
      material_id: formData.material_id || null,
      material_name: formData.material_name,
      color: formData.color,
      color_hex: formData.color_hex,
      original_weight_grams: parseFloat(formData.original_weight_grams),
      remaining_weight_grams: parseFloat(formData.remaining_weight_grams),
      price_paid: formData.price_paid ? parseFloat(formData.price_paid) : null,
      min_weight_grams: parseFloat(formData.min_weight_grams),
      location: formData.location || null,
      notes: formData.notes || null,
      active: true,
    };

    let error;
    if (editingFilament) {
      const result = await supabase
        .from('filaments')
        .update(data)
        .eq('id', editingFilament.id);
      error = result.error;
    } else {
      const result = await supabase.from('filaments').insert([data]);
      error = result.error;
    }

    if (error) {
      toast.error('Błąd', { description: 'Nie udało się zapisać filamentu' });
    } else {
      toast.success(editingFilament ? 'Zaktualizowano' : 'Dodano filament');
      setDialogOpen(false);
      resetForm();
      fetchFilaments();
    }
  };

  const resetForm = () => {
    setFormData({
      brand: '',
      material_id: '',
      material_name: '',
      color: '',
      color_hex: '#FFFFFF',
      original_weight_grams: '1000',
      remaining_weight_grams: '1000',
      price_paid: '',
      min_weight_grams: '100',
      location: '',
      notes: '',
    });
    setEditingFilament(null);
  };

  const openEditDialog = (filament: Filament) => {
    setEditingFilament(filament);
    setFormData({
      brand: filament.brand,
      material_id: filament.material_id || '',
      material_name: filament.material_name,
      color: filament.color,
      color_hex: filament.color_hex || '#FFFFFF',
      original_weight_grams: filament.original_weight_grams?.toString() || '1000',
      remaining_weight_grams: filament.remaining_weight_grams.toString(),
      price_paid: filament.price_paid?.toString() || '',
      min_weight_grams: filament.min_weight_grams?.toString() || '100',
      location: filament.location || '',
      notes: filament.notes || '',
    });
    setDialogOpen(true);
  };

  const deleteFilament = async (id: string) => {
    const { error } = await supabase
      .from('filaments')
      .update({ active: false })
      .eq('id', id);

    if (error) {
      toast.error('Błąd', { description: 'Nie udało się usunąć filamentu' });
    } else {
      toast.success('Usunięto filament');
      fetchFilaments();
    }
  };

  const getPercentageRemaining = (filament: Filament) => {
    if (!filament.original_weight_grams) return 0;
    return (filament.remaining_weight_grams / filament.original_weight_grams) * 100;
  };

  const isLowFilament = (filament: Filament) => {
    return filament.remaining_weight_grams <= (filament.min_weight_grams || 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Magazyn filamentów
          </h1>
          <p className="text-muted-foreground mt-1">
            Zarządzaj szpulkami filamentów i śledź stan
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchFilaments} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:shadow-glow">
                <Plus className="w-4 h-4 mr-2" />
                Dodaj filament
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingFilament ? 'Edytuj filament' : 'Dodaj nowy filament'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="form-label">Marka</label>
                    <Input
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="e.g. eSUN, Polymaker"
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Materiał</label>
                    <Select
                      value={formData.material_id}
                      onValueChange={(value) => {
                        const mat = materials.find((m) => m.id === value);
                        setFormData({
                          ...formData,
                          material_id: value,
                          material_name: mat?.name || '',
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 bg-secondary border-border">
                        <SelectValue placeholder="Wybierz" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {materials.map((mat) => (
                          <SelectItem key={mat.id} value={mat.id}>
                            {mat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="form-label">Kolor</label>
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="e.g. Czerwony"
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Kod HEX</label>
                    <div className="flex gap-2">
                      <Input
                        value={formData.color_hex}
                        onChange={(e) => setFormData({ ...formData, color_hex: e.target.value })}
                        className="h-11 bg-secondary border-border"
                      />
                      <div
                        className="w-11 h-11 rounded-lg border border-border"
                        style={{ backgroundColor: formData.color_hex }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="form-label">Waga oryginalna (g)</label>
                    <Input
                      type="number"
                      value={formData.original_weight_grams}
                      onChange={(e) => setFormData({ ...formData, original_weight_grams: e.target.value })}
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Pozostało (g)</label>
                    <Input
                      type="number"
                      value={formData.remaining_weight_grams}
                      onChange={(e) => setFormData({ ...formData, remaining_weight_grams: e.target.value })}
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="form-label">Cena zakupu (zł)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price_paid}
                      onChange={(e) => setFormData({ ...formData, price_paid: e.target.value })}
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Alarm przy (g)</label>
                    <Input
                      type="number"
                      value={formData.min_weight_grams}
                      onChange={(e) => setFormData({ ...formData, min_weight_grams: e.target.value })}
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="form-label">Lokalizacja</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Półka A1"
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label">Notatki</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full h-20 bg-secondary border border-border rounded-lg p-3 text-foreground"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleSubmit}
                    className="flex-1 bg-gradient-primary hover:shadow-glow"
                  >
                    {editingFilament ? 'Zapisz zmiany' : 'Dodaj filament'}
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Anuluj
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFilaments()}
              placeholder="Szukaj po marce, materiale, kolorze..."
              className="pl-12 h-11 bg-secondary border-border"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {filaments.filter((f) => f.active).length}
                </p>
                <p className="text-sm text-muted-foreground">Aktywnych szpulek</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {filaments.filter((f) => isLowFilament(f)).length}
                </p>
                <p className="text-sm text-muted-foreground">Kończy się</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Weight className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {filaments
                    .reduce((sum, f) => sum + f.remaining_weight_grams, 0)
                    .toFixed(0)}g
                </p>
                <p className="text-sm text-muted-foreground">Łącznie waga</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Box className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {materials.length}
                </p>
                <p className="text-sm text-muted-foreground">Dostępne materiały</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filaments Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filaments.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Brak filamentów</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filaments.map((filament) => {
            const percentage = getPercentageRemaining(filament);
            const isLow = isLowFilament(filament);
            const percentageColor =
              percentage > 50 ? 'bg-green-500' : percentage > 25 ? 'bg-yellow-500' : 'bg-red-500';

            return (
              <Card
                key={filament.id}
                className={`bg-card border-border ${
                  isLow ? 'border-red-500/50' : ''
                } transition-all hover:border-primary/50`}
              >
                <CardContent className="p-4">
                  {/* Color indicator */}
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-xl border border-border"
                      style={{ backgroundColor: filament.color_hex || '#FFFFFF' }}
                    />
                    {isLow && (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="mb-4">
                    <h3 className="font-semibold text-foreground mb-1">
                      {filament.brand} - {filament.color}
                    </h3>
                    <p className="text-sm text-muted-foreground">{filament.material_name}</p>
                  </div>

                  {/* Weight progress */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Pozostało</span>
                      <span className="font-medium text-foreground">
                        {filament.remaining_weight_grams}g
                      </span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${percentageColor} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-muted-foreground">
                        z {filament.original_weight_grams}g
                      </span>
                      <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Location */}
                  {filament.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <MapPin className="w-4 h-4" />
                      {filament.location}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(filament)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edytuj
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteFilament(filament.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
