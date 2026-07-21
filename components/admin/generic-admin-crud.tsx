'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { CheckCircle2, Edit, ImagePlus, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { OptimizedImage } from '@/components/ui/optimized-image';

type FieldType = 'text' | 'number' | 'textarea' | 'boolean' | 'date' | 'color' | 'image';

export type CrudField = {
  key: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  options?: Array<{ label: string; value: string }>;
};

export type CrudColumn = {
  key: string;
  label: string;
  type?: 'text' | 'money' | 'boolean' | 'date' | 'color' | 'status' | 'number';
};

export type AdminCrudConfig = {
  title: string;
  description: string;
  table: string;
  orderBy?: string;
  addLabel?: string;
  searchKeys?: string[];
  fields: CrudField[];
  columns: CrudColumn[];
  defaultInsert?: Record<string, unknown>;
  softDeleteField?: string;
  readOnly?: boolean;
  allowCreate?: boolean;
  filters?: Array<{
    field: string;
    operator?: 'eq' | 'in';
    value: unknown;
  }>;
};

type DbRow = Record<string, any>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `pozycja-${Date.now()}`;

const makeDefaultValue = (field: CrudField) => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === 'boolean') return true;
  if (field.type === 'number') return '';
  return '';
};

const normalizeValue = (field: CrudField, value: unknown) => {
  if (field.type === 'number') {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (field.type === 'boolean') return Boolean(value);
  if (field.type === 'date') return value ? String(value) : null;
  return typeof value === 'string' ? value.trim() || null : value ?? null;
};

const renderValue = (row: DbRow, column: CrudColumn) => {
  const value = row[column.key];
  if (column.type === 'boolean') return <Badge variant={value ? 'default' : 'secondary'}>{value ? 'Tak' : 'Nie'}</Badge>;
  if (column.type === 'money') return `${Number(value || 0).toFixed(2)} zł`;
  if (column.type === 'number') return Number(value || 0).toLocaleString('pl-PL');
  if (column.type === 'date') return value ? new Date(value).toLocaleDateString('pl-PL') : '—';
  if (column.type === 'color') return <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded-full border" style={{ background: String(value || '#ffffff') }} />{String(value || '—')}</span>;
  if (column.type === 'status') return <Badge variant="outline">{String(value || '—')}</Badge>;
  return String(value ?? '—');
};

export function GenericAdminCrud({ config }: { config: AdminCrudConfig }) {
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DbRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<Record<string, File | null>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(config.fields.map((field) => [field.key, makeDefaultValue(field)]))
  );

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    const keys = config.searchKeys || config.columns.map((column) => column.key);
    return rows.filter((row) => keys.some((key) => String(row[key] ?? '').toLowerCase().includes(term)));
  }, [config.columns, config.searchKeys, rows, search]);
  const tableColSpan = config.columns.length + (config.readOnly ? 0 : 1);

  const resetForm = () => {
    Object.values(imagePreviews).forEach((preview) => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    });
    setEditingRow(null);
    setImageFiles({});
    setImagePreviews({});
    setFormData(Object.fromEntries(config.fields.map((field) => [field.key, makeDefaultValue(field)])));
  };

  const fetchRows = async () => {
    setLoading(true);
    setLoadError(null);
    let query = (supabase as any).from(config.table).select('*');
    for (const filter of config.filters || []) {
      query = filter.operator === 'in'
        ? query.in(filter.field, filter.value)
        : query.eq(filter.field, filter.value);
    }
    if (config.orderBy) query = query.order(config.orderBy, { ascending: false });
    const { data, error } = await query;
    if (error) {
      toast.error(`Nie udało się pobrać danych: ${config.title}`, { description: error.message });
      setLoadError(error.message);
      setRows([]);
    } else {
      setRows((data || []) as DbRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table]);

  const openEdit = (row: DbRow) => {
    setEditingRow(row);
    setFormData(Object.fromEntries(config.fields.map((field) => [field.key, row[field.key] ?? makeDefaultValue(field)])));
    setImageFiles({});
    setImagePreviews(Object.fromEntries(
      config.fields
        .filter((field) => field.type === 'image' && row[field.key])
        .map((field) => [field.key, String(row[field.key])])
    ));
    setDialogOpen(true);
  };

  const handleImageChange = (fieldKey: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Wybierz plik graficzny');
      setSaving(false);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Zdjęcie jest za duże', { description: 'Maksymalny rozmiar pliku to 5 MB.' });
      setSaving(false);
      return;
    }

    const previousPreview = imagePreviews[fieldKey];
    if (previousPreview?.startsWith('blob:')) URL.revokeObjectURL(previousPreview);

    setImageFiles((current) => ({ ...current, [fieldKey]: file }));
    setImagePreviews((current) => ({ ...current, [fieldKey]: URL.createObjectURL(file) }));
    setFormData((current) => ({ ...current, [fieldKey]: current[fieldKey] || '' }));
  };

  const removeImage = (fieldKey: string) => {
    const previousPreview = imagePreviews[fieldKey];
    if (previousPreview?.startsWith('blob:')) URL.revokeObjectURL(previousPreview);

    setImageFiles((current) => ({ ...current, [fieldKey]: null }));
    setImagePreviews((current) => {
      const next = { ...current };
      delete next[fieldKey];
      return next;
    });
    setFormData((current) => ({ ...current, [fieldKey]: '' }));
  };

  const uploadImage = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileName = `admin-${config.table}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl;
  };

  const handleSubmit = async () => {
    if (saving) return;

    const missing = config.fields.find((field) => field.required && !String(formData[field.key] ?? '').trim());
    if (missing) {
      toast.error('Uzupełnij wymagane pole', { description: missing.label });
      return;
    }

    setSaving(true);
    const payload: DbRow = { ...(config.defaultInsert || {}) };

    try {
      for (const field of config.fields) {
        if (field.type === 'image' && imageFiles[field.key]) {
          payload[field.key] = await uploadImage(imageFiles[field.key] as File);
        } else {
          payload[field.key] = normalizeValue(field, formData[field.key]);
        }
      }
    } catch (error) {
      setSaving(false);
      toast.error('Błąd przesyłania zdjęcia', {
        description: error instanceof Error ? error.message : 'Nie udało się przesłać zdjęcia.',
      });
      return;
    }

    if ('name' in payload && !payload.slug && config.table !== 'profiles') payload.slug = slugify(String(payload.name));
    if ('title' in payload && !payload.slug) payload.slug = slugify(String(payload.title));
    if (config.table === 'products' && !payload.sku) payload.sku = `KORIX-${Date.now().toString().slice(-8)}`;
    if (config.table === 'warehouse_items' && !payload.sku) payload.sku = `MAG-${Date.now().toString().slice(-8)}`;
    if (['products', 'warehouse_items', 'portfolio_items'].includes(config.table) && payload.image_url && !payload.images) payload.images = [payload.image_url];
    if (config.table === 'blog_posts' && payload.published && !payload.published_at) payload.published_at = new Date().toISOString();
    if ('updated_at' in (editingRow || {}) || ['products', 'materials', 'orders_3d', 'filaments', 'warehouse_items', 'store_orders', 'blog_posts', 'faq_items', 'settings'].includes(config.table)) {
      payload.updated_at = new Date().toISOString();
    }

    const result = editingRow
      ? await (supabase as any).from(config.table).update(payload).eq('id', editingRow.id)
      : await (supabase as any).from(config.table).insert([payload]);

    if (result.error) {
      setSaving(false);
      toast.error('Błąd zapisu', { description: result.error.message });
      return;
    }

    toast.success(editingRow ? 'Zapisano zmiany' : 'Dodano pozycję');
    setDialogOpen(false);
    resetForm();
    setSaving(false);
    fetchRows();
  };

  const deleteRow = async (row: DbRow) => {
    const rowLabel = row.name || row.title || row.order_number || row.email || row.code || row.id;
    const actionLabel = config.softDeleteField ? 'ukryć/dezaktywować' : 'trwale usunąć';
    if (!window.confirm(`Czy na pewno chcesz ${actionLabel} pozycję „${rowLabel}”?`)) return;

    setDeletingRowId(String(row.id));
    try {
      const result = config.softDeleteField
        ? await (supabase as any).from(config.table).update({ [config.softDeleteField]: false, updated_at: new Date().toISOString() }).eq('id', row.id)
        : await (supabase as any).from(config.table).delete().eq('id', row.id);

      if (result.error) toast.error('Nie udało się usunąć pozycji', { description: result.error.message });
      else {
        toast.success(config.softDeleteField ? 'Pozycja ukryta/dezaktywowana' : 'Pozycja usunięta');
        fetchRows();
      }
    } finally {
      setDeletingRowId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{config.title}</h1>
          <p className="text-muted-foreground mt-1">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRows} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Odśwież
          </Button>
          {!config.readOnly && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && saving) return; setDialogOpen(open); if (!open) resetForm(); }}>
              {config.allowCreate !== false && (
                <DialogTrigger asChild>
                  <Button className="bg-gradient-primary hover:shadow-glow"><Plus className="w-4 h-4 mr-2" />{config.addLabel || 'Dodaj'}</Button>
                </DialogTrigger>
              )}
              <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingRow ? 'Edytuj pozycję' : config.addLabel || 'Dodaj pozycję'}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {config.fields.map((field) => (
                    <div key={field.key} className={['textarea', 'image'].includes(field.type || '') ? 'sm:col-span-2 space-y-2' : 'space-y-2'}>
                      <label className="form-label">{field.label}{field.required ? ' *' : ''}</label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={String(formData[field.key] ?? '')}
                          onChange={(event) => setFormData({ ...formData, [field.key]: event.target.value })}
                          placeholder={field.placeholder}
                          className="w-full h-28 bg-secondary border border-border rounded-lg p-3 text-foreground"
                        />
                      ) : field.type === 'boolean' ? (
                        <label className="flex items-center gap-3 h-11 px-3 rounded-lg border border-border bg-secondary">
                          <input
                            type="checkbox"
                            checked={Boolean(formData[field.key])}
                            onChange={(event) => setFormData({ ...formData, [field.key]: event.target.checked })}
                          />
                          <span className="text-sm text-muted-foreground">Włączone</span>
                        </label>
                      ) : field.options?.length ? (
                        <select
                          value={String(formData[field.key] ?? '')}
                          onChange={(event) => setFormData({ ...formData, [field.key]: event.target.value })}
                          className="h-11 w-full rounded-md border border-border bg-secondary px-3 text-sm text-foreground"
                        >
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'image' ? (
                        <div className="space-y-3">
                          {imagePreviews[field.key] ? (
                            <div className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
                              <OptimizedImage
                                src={imagePreviews[field.key]}
                                alt={`Podgląd: ${field.label}`}
                                className="h-24 w-24 rounded-md border object-cover"
                                sizes="96px"
                              />
                              <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="outline" asChild>
                                  <label className="cursor-pointer">
                                    <ImagePlus className="mr-2 h-4 w-4" />
                                    Zmień zdjęcie
                                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageChange(field.key, event)} />
                                  </label>
                                </Button>
                                <Button type="button" variant="outline" onClick={() => removeImage(field.key)}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Usuń
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-5 text-center transition-colors hover:bg-muted/50">
                              <ImagePlus className="h-7 w-7 text-muted-foreground" />
                              <span className="font-medium">Wybierz zdjęcie z urządzenia</span>
                              <span className="text-xs text-muted-foreground">JPG, PNG lub WebP do 5 MB</span>
                              <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleImageChange(field.key, event)} />
                            </label>
                          )}
                        </div>
                      ) : (
                        <Input
                          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'color' ? 'color' : 'text'}
                          step={field.type === 'number' ? '0.01' : undefined}
                          min={field.type === 'number' ? '0' : undefined}
                          value={String(formData[field.key] ?? '')}
                          onChange={(event) => setFormData({ ...formData, [field.key]: event.target.value })}
                          placeholder={field.placeholder}
                          className="h-11 bg-secondary border-border"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-gradient-primary hover:shadow-glow"><CheckCircle2 className="w-4 h-4 mr-2" />{saving ? 'Zapisywanie...' : 'Zapisz'}</Button>
                  <Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>Anuluj</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Wszystkie pozycje</p><p className="text-3xl font-bold mt-1">{rows.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Widoczne po filtrze</p><p className="text-3xl font-bold mt-1">{visibleRows.length}</p></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><p className="text-sm text-muted-foreground">Status</p><p className="text-lg font-semibold mt-2">{loading ? 'Ładowanie...' : loadError ? 'Błąd pobierania' : 'Gotowe'}</p></CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <CardTitle>Lista</CardTitle>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj..." className="pl-9 bg-secondary border-border" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  {config.columns.map((column) => <th key={column.key} className="py-3 pr-4 font-medium">{column.label}</th>)}
                  {!config.readOnly && <th className="py-3 pr-4 font-medium text-right">Akcje</th>}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td className="py-10 text-center text-muted-foreground" colSpan={tableColSpan}>
                      Pobieram dane...
                    </td>
                  </tr>
                )}
                {!loading && loadError && (
                  <tr>
                    <td className="py-10 text-center" colSpan={tableColSpan}>
                      <div className="mx-auto max-w-md space-y-3">
                        <p className="font-medium text-destructive">Nie udało się pobrać danych.</p>
                        <p className="text-sm text-muted-foreground">{loadError}</p>
                        <Button variant="outline" size="sm" onClick={fetchRows}>
                          Spróbuj ponownie
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && !loadError && visibleRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    {config.columns.map((column) => <td key={column.key} className="py-3 pr-4 align-top max-w-[280px] truncate">{renderValue(row, column)}</td>)}
                    {!config.readOnly && (
                    <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Edit className="w-4 h-4" /></Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deletingRowId === String(row.id)}
                            onClick={() => deleteRow(row)}
                            aria-label={config.softDeleteField ? 'Ukryj pozycję' : 'Usuń pozycję'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                    </td>
                    )}
                  </tr>
                ))}
                {!loading && !loadError && visibleRows.length === 0 && (
                  <tr><td className="py-10 text-center text-muted-foreground" colSpan={tableColSpan}>Brak danych do wyświetlenia.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
