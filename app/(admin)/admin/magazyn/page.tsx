'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptimizedImage } from '@/components/ui/optimized-image';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Edit, ImagePlus, Loader2, Package, Plus, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { Category, Product } from '@/lib/types/database';
import { PanelError } from '@/components/customer/panel-state';
import Link from 'next/link';

const emptyForm = {
  sku: '',
  name: '',
  slug: '',
  short_description: '',
  description: '',
  category_id: '',
  price: '',
  compare_price: '',
  cost_price: '',
  stock_quantity: '0',
  min_stock_quantity: '0',
  weight_grams: '',
  active: true,
  featured: false,
};

type ProductForm = typeof emptyForm;

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const MAX_PRODUCT_IMAGES = 8;

function createSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseDecimal(value: string) {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : NaN;
}

export default function AdminWarehousePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imagePreviewsRef = useRef<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const filteredProducts = useMemo(() => {
    const phrase = search.toLowerCase().trim();
    if (!phrase) return products;

    return products.filter((product) =>
      [product.name, product.sku, product.slug]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(phrase))
    );
  }, [products, search]);

  const lowStockCount = products.filter(
    (product) => product.stock_quantity > 0 && product.stock_quantity <= (product.min_stock_quantity || 0)
  ).length;
  const outOfStockCount = products.filter((product) => product.stock_quantity <= 0).length;

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setError('Nie udało się pobrać produktów z Supabase.');
        setProducts([]);
        toast.error('Błąd', { description: 'Nie udało się pobrać produktów' });
      } else {
        setProducts((data || []) as Product[]);
      }
    } catch {
      setError('Nie udało się połączyć z Supabase podczas pobierania produktów.');
      setProducts([]);
      toast.error('Błąd', { description: 'Nie udało się połączyć z Supabase' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) {
        toast.error('Błąd', { description: 'Nie udało się pobrać kategorii produktów' });
        setCategories([]);
      } else {
        setCategories((data || []) as Category[]);
      }
    } catch {
      toast.error('Błąd', { description: 'Nie udało się połączyć z Supabase podczas pobierania kategorii' });
      setCategories([]);
    }
  };

  const resetForm = () => {
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setEditingProduct(null);
    setFormData(emptyForm);
    setExistingImageUrls([]);
    setImageFiles([]);
    setImagePreviews([]);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    const productImages = Array.isArray(product.images)
      ? (product.images as string[]).filter(Boolean).slice(0, MAX_PRODUCT_IMAGES)
      : [];
    setEditingProduct(product);
    setFormData({
      sku: product.sku || '',
      name: product.name || '',
      slug: product.slug || '',
      short_description: product.short_description || '',
      description: product.description || '',
      category_id: product.category_id || '',
      price: String(product.price ?? ''),
      compare_price: product.compare_price ? String(product.compare_price) : '',
      cost_price: product.cost_price ? String(product.cost_price) : '',
      stock_quantity: String(product.stock_quantity ?? 0),
      min_stock_quantity: String(product.min_stock_quantity ?? 0),
      weight_grams: product.weight_grams ? String(product.weight_grams) : '',
      active: product.active ?? true,
      featured: product.featured ?? false,
    });
    imagePreviews.forEach((preview) => URL.revokeObjectURL(preview));
    setExistingImageUrls(productImages);
    setImageFiles([]);
    setImagePreviews([]);
    setDialogOpen(true);
  };

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews;
  }, [imagePreviews]);

  useEffect(() => () => {
    imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (selectedFiles.length === 0) return;

    const availableSlots = MAX_PRODUCT_IMAGES - existingImageUrls.length - imageFiles.length;
    if (availableSlots <= 0) {
      toast.error('Osiągnięto limit zdjęć', { description: 'Produkt może mieć maksymalnie 8 zdjęć.' });
      return;
    }

    const accepted: File[] = [];
    for (const file of selectedFiles.slice(0, availableSlots)) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error('Nieobsługiwany format zdjęcia', { description: `${file.name}: wybierz JPG, PNG lub WebP.` });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Zdjęcie jest za duże', { description: `${file.name}: maksymalnie 5 MB.` });
        continue;
      }
      accepted.push(file);
    }

    setImageFiles((current) => [...current, ...accepted]);
    setImagePreviews((current) => [
      ...current,
      ...accepted.map((file) => URL.createObjectURL(file)),
    ]);
  };

  const removePendingImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImagePreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const uploadImage = async (file: File) => {
    const extension = ALLOWED_IMAGE_TYPES.get(file.type);
    if (!extension) throw new Error('Nieobsługiwany format zdjęcia.');
    const fileName = `products/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('product-images').upload(fileName, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    return {
      path: fileName,
      publicUrl: supabase.storage.from('product-images').getPublicUrl(fileName).data.publicUrl,
    };
  };

  const getManagedImagePath = (value: string) => {
    try {
      const marker = '/storage/v1/object/public/product-images/';
      const url = new URL(value);
      const markerIndex = url.pathname.indexOf(marker);
      if (markerIndex < 0) return null;
      const path = decodeURIComponent(url.pathname.slice(markerIndex + marker.length));
      return path && !path.includes('..') ? path : null;
    } catch {
      return null;
    }
  };

  const removeStoredImages = async (paths: string[]) => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (uniquePaths.length === 0) return;
    const { error } = await supabase.storage.from('product-images').remove(uniquePaths);
    if (error) console.error('Product image cleanup error:', error);
  };

  const handleNameChange = (name: string) => {
    setFormData((current) => ({
      ...current,
      name,
      slug: editingProduct || current.slug ? current.slug : createSlug(name),
    }));
  };

  const handleSubmit = async () => {
    if (saving) return;

    if (!formData.sku || !formData.name || !formData.price) {
      toast.error('Uzupełnij wymagane pola', {
        description: 'SKU, nazwa i cena są wymagane.',
      });
      return;
    }

    const price = parseDecimal(formData.price);
    const comparePrice = formData.compare_price ? parseDecimal(formData.compare_price) : null;
    const costPrice = formData.cost_price ? parseDecimal(formData.cost_price) : null;
    const stockQuantity = Number.parseInt(formData.stock_quantity || '0', 10);
    const minStockQuantity = Number.parseInt(formData.min_stock_quantity || '0', 10);
    const weightGrams = formData.weight_grams ? Number.parseInt(formData.weight_grams, 10) : null;

    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Podaj poprawną cenę produktu większą od 0.');
      return;
    }

    if (
      (comparePrice !== null && (!Number.isFinite(comparePrice) || comparePrice < 0)) ||
      (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0)) ||
      !Number.isFinite(stockQuantity) ||
      !Number.isFinite(minStockQuantity) ||
      stockQuantity < 0 ||
      minStockQuantity < 0 ||
      (weightGrams !== null && (!Number.isFinite(weightGrams) || weightGrams < 0))
    ) {
      toast.error('Sprawdź wartości liczbowe', {
        description: 'Stan, minimum, koszt i waga nie mogą być ujemne.',
      });
      return;
    }

    setSaving(true);
    const uploadedImages: Array<{ path: string; publicUrl: string }> = [];
    try {
      for (const file of imageFiles) {
        uploadedImages.push(await uploadImage(file));
      }

      const payload = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        slug: formData.slug.trim() || createSlug(formData.name),
        short_description: formData.short_description || null,
        description: formData.description || null,
        category_id: formData.category_id || null,
        price,
        compare_price: comparePrice,
        cost_price: costPrice,
        stock_quantity: stockQuantity,
        min_stock_quantity: minStockQuantity,
        weight_grams: weightGrams,
        images: [...existingImageUrls, ...uploadedImages.map((image) => image.publicUrl)],
        active: formData.active,
        featured: formData.featured,
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingProduct
            ? {
                ...payload,
                id: editingProduct.id,
                expected_updated_at: editingProduct.updated_at,
              }
            : payload
        ),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        await removeStoredImages(uploadedImages.map((image) => image.path));
        toast.error('Błąd zapisu', { description: result?.error || 'Nie udało się zapisać produktu.' });
        return;
      }

      if (editingProduct) {
        const originalImages = Array.isArray(editingProduct.images)
          ? (editingProduct.images as string[]).filter(Boolean)
          : [];
        const removedPaths = originalImages
          .filter((image) => !existingImageUrls.includes(image))
          .map(getManagedImagePath)
          .filter((path): path is string => Boolean(path));
        await removeStoredImages(removedPaths);
      }

      toast.success(editingProduct ? 'Produkt zaktualizowany' : 'Produkt dodany');
      setDialogOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      await removeStoredImages(uploadedImages.map((image) => image.path));
      toast.error('Błąd zapisu', {
        description: error instanceof Error ? error.message : 'Nie udało się zapisać produktu.',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (product: Product) => {
    if (deletingProductId) return;
    if (!window.confirm(`Usunąć produkt „${product.name}” ze sklepu? Historia i zamówienia zostaną zachowane.`)) return;

    setDeletingProductId(product.id);
    try {
      const response = await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, {
        method: 'DELETE',
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Nie udało się usunąć produktu ze sklepu.');

      toast.success('Produkt został usunięty ze sklepu');
      await fetchProducts();
    } catch (error) {
      toast.error('Błąd usuwania', {
        description: error instanceof Error ? error.message : 'Nie udało się usunąć produktu ze sklepu.',
      });
    } finally {
      setDeletingProductId(null);
    }
  };

  const getStockBadge = (product: Product) => {
    if (product.stock_quantity <= 0) {
      return <Badge variant="destructive">Brak</Badge>;
    }

    if (product.stock_quantity <= (product.min_stock_quantity || 0)) {
      return <Badge className="bg-orange-500 hover:bg-orange-600">Niski stan</Badge>;
    }

    return <Badge className="bg-green-600 hover:bg-green-700">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Magazyn produktów</h1>
          <p className="text-muted-foreground">
            Dodawaj produkty do sklepu i edytuj stany magazynowe.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline">
            <Link href="/admin/historia?modul=products">Historia zmian</Link>
          </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Dodaj produkt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Edytuj produkt' : 'Dodaj produkt'}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>SKU *</Label>
                <Input
                  value={formData.sku}
                  onChange={(event) => setFormData({ ...formData, sku: event.target.value })}
                  placeholder="np. PLA-CZARNY-1KG"
                />
              </div>

              <div className="space-y-2">
                <Label>Nazwa *</Label>
                <Input
                  value={formData.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="np. Filament PLA czarny 1kg"
                />
              </div>

              <div className="space-y-2">
                <Label>Slug / adres URL</Label>
                <Input
                  value={formData.slug}
                  onChange={(event) => setFormData({ ...formData, slug: createSlug(event.target.value) })}
                  placeholder="filament-pla-czarny-1kg"
                />
              </div>

              <div className="space-y-2">
                <Label>Kategoria</Label>
                <Select
                  value={formData.category_id || 'none'}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak kategorii</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cena sprzedaży *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(event) => setFormData({ ...formData, price: event.target.value })}
                  placeholder="99.99"
                />
              </div>

              <div className="space-y-2">
                <Label>Cena promocyjna / przekreślona</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.compare_price}
                  onChange={(event) => setFormData({ ...formData, compare_price: event.target.value })}
                  placeholder="129.99"
                />
              </div>

              <div className="space-y-2">
                <Label>Koszt zakupu</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(event) => setFormData({ ...formData, cost_price: event.target.value })}
                  placeholder="60.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Waga produktu (g)</Label>
                <Input
                  type="number"
                  value={formData.weight_grams}
                  onChange={(event) => setFormData({ ...formData, weight_grams: event.target.value })}
                  placeholder="1000"
                />
              </div>

              <div className="space-y-2">
                <Label>Stan magazynowy</Label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(event) => setFormData({ ...formData, stock_quantity: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Minimalny stan</Label>
                <Input
                  type="number"
                  value={formData.min_stock_quantity}
                  onChange={(event) => setFormData({ ...formData, min_stock_quantity: event.target.value })}
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Galeria produktu</Label>
                {(existingImageUrls.length > 0 || imagePreviews.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {existingImageUrls.map((image) => (
                      <div key={image} className="relative aspect-square overflow-hidden rounded-lg border bg-secondary">
                        <OptimizedImage src={image} alt="Zdjęcie produktu" className="h-full w-full object-cover" sizes="160px" />
                        <button
                          type="button"
                          onClick={() => setExistingImageUrls((current) => current.filter((item) => item !== image))}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow"
                          aria-label="Usuń zdjęcie z galerii"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {imagePreviews.map((preview, index) => (
                      <div key={preview} className="relative aspect-square overflow-hidden rounded-lg border bg-secondary">
                        <OptimizedImage src={preview} alt="Nowe zdjęcie produktu" className="h-full w-full object-cover" sizes="160px" />
                        <button
                          type="button"
                          onClick={() => removePendingImage(index)}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive shadow"
                          aria-label="Usuń nowe zdjęcie"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {existingImageUrls.length + imageFiles.length < MAX_PRODUCT_IMAGES && (
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center transition-colors hover:bg-muted/50">
                    <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    <span className="font-medium">Dodaj zdjęcia z urządzenia</span>
                    <span className="text-xs text-muted-foreground">Do 8 plików JPG, PNG lub WebP; każdy do 5 MB</span>
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleImageChange} />
                  </label>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Krótki opis</Label>
                <Input
                  value={formData.short_description}
                  onChange={(event) => setFormData({ ...formData, short_description: event.target.value })}
                  placeholder="Widoczny na karcie produktu"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Opis</Label>
                <Textarea
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  placeholder="Pełny opis produktu"
                  rows={4}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Aktywny w sklepie</Label>
                  <p className="text-xs text-muted-foreground">Wyłącz, aby ukryć produkt na stronie.</p>
                </div>
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Wyróżniony</Label>
                  <p className="text-xs text-muted-foreground">Może być używany na stronie głównej.</p>
                </div>
                <Switch
                  checked={formData.featured}
                  onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
                Anuluj
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Zapisywanie...' : editingProduct ? 'Zapisz zmiany' : 'Dodaj produkt'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Produkty</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Niski stan</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Brak na stanie</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{outOfStockCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Szukaj po nazwie, SKU lub slugu..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" disabled={loading} onClick={fetchProducts}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Odśwież
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Ładowanie produktów...</div>
          ) : error ? (
            <div className="p-6"><PanelError message={error} onRetry={fetchProducts} /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Brak produktów</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left">
                  <tr>
                    <th className="p-4 font-medium">Produkt</th>
                    <th className="p-4 font-medium">SKU</th>
                    <th className="p-4 font-medium">Cena</th>
                    <th className="p-4 font-medium">Stan</th>
                    <th className="p-4 font-medium">Minimum</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 text-right font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b last:border-0">
                      <td className="p-4">
                        <div className="font-medium text-foreground">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.active ? 'Widoczny w sklepie' : 'Ukryty'}
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{product.sku}</td>
                      <td className="p-4">{Number(product.price).toFixed(2)} zł</td>
                      <td className="p-4 font-semibold">{product.stock_quantity} szt.</td>
                      <td className="p-4 text-muted-foreground">{product.min_stock_quantity || 0} szt.</td>
                      <td className="p-4">{getStockBadge(product)}</td>
                      <td className="p-4 text-right">
                        <div className="inline-flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edytuj
                          </Button>
                          {product.active && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deletingProductId === product.id}
                              onClick={() => deleteProduct(product)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Usuń
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
