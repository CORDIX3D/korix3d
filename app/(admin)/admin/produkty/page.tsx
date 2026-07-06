'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { ImagePlus, Package, Plus, RefreshCw, Search, Trash2, Edit, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Product } from '@/lib/types/database';
import { toast } from 'sonner';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `produkt-${Date.now()}`;

const makeSku = () => `KORIX-${Date.now().toString().slice(-8)}`;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    price_per_kg: '',
    stock_quantity: '1',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.description || '', product.sku || ''].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [products, search]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Błąd', { description: 'Nie udało się pobrać produktów' });
    } else if (data) {
      setProducts(data as Product[]);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', description: '', image_url: '', price_per_kg: '', stock_quantity: '1' });
  };

  const openEditDialog = (product: Product) => {
    const images = Array.isArray(product.images) ? product.images : [];
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      image_url: typeof images[0] === 'string' ? images[0] : '',
      price_per_kg: product.price?.toString() || '',
      stock_quantity: product.stock_quantity?.toString() || '1',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const name = formData.name.trim();
    const description = formData.description.trim();
    const imageUrl = formData.image_url.trim();
    const pricePerKg = Number(formData.price_per_kg);
    const stockQuantity = Number(formData.stock_quantity || 0);

    if (!name || !description || !imageUrl || !Number.isFinite(pricePerKg) || pricePerKg <= 0) {
      toast.error('Uzupełnij wymagane pola', {
        description: 'Wymagane: zdjęcie, nazwa, opis i cena z kilograma większa od 0.',
      });
      return;
    }

    const data = {
      sku: editingProduct?.sku || makeSku(),
      name,
      slug: editingProduct?.slug || slugify(name),
      description,
      short_description: description.slice(0, 140),
      price: pricePerKg,
      images: [imageUrl],
      stock_quantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
      min_stock_quantity: 0,
      active: true,
      featured: false,
      updated_at: new Date().toISOString(),
    };

    const result = editingProduct
      ? await supabase.from('products').update(data).eq('id', editingProduct.id)
      : await supabase.from('products').insert([data]);

    if (result.error) {
      toast.error('Błąd zapisu', { description: result.error.message });
      return;
    }

    toast.success(editingProduct ? 'Produkt zaktualizowany' : 'Produkt dodany do sklepu');
    setDialogOpen(false);
    resetForm();
    fetchProducts();
  };

  const toggleActive = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ active: !product.active, updated_at: new Date().toISOString() })
      .eq('id', product.id);

    if (error) toast.error('Nie udało się zmienić widoczności produktu');
    else fetchProducts();
  };

  const deleteProduct = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', product.id);

    if (error) toast.error('Nie udało się ukryć produktu');
    else {
      toast.success('Produkt ukryty w sklepie');
      fetchProducts();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Produkty sklepu</h1>
          <p className="text-muted-foreground mt-1">
            Szybkie dodawanie: zdjęcie, nazwa, opis i cena z kilograma.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchProducts} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:shadow-glow">
                <Plus className="w-4 h-4 mr-2" />
                Dodaj produkt
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-xl">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edytuj produkt' : 'Dodaj produkt do sklepu'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="form-label">Zdjęcie produktu - adres URL *</label>
                  <Input
                    value={formData.image_url}
                    onChange={(event) => setFormData({ ...formData, image_url: event.target.value })}
                    placeholder="https://.../zdjecie.jpg"
                    className="h-11 bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Wklej link do zdjęcia. Produkt od razu pojawi się w sklepie z tym obrazem.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="form-label">Nazwa *</label>
                  <Input
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    placeholder="Np. Figurka 3D, uchwyt, gadżet"
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Opis *</label>
                  <textarea
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    placeholder="Krótki opis produktu widoczny w sklepie"
                    className="w-full h-28 bg-secondary border border-border rounded-lg p-3 text-foreground"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="form-label">Cena z kilograma (zł/kg) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price_per_kg}
                      onChange={(event) => setFormData({ ...formData, price_per_kg: event.target.value })}
                      placeholder="Np. 89.99"
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="form-label">Ilość w sklepie</label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.stock_quantity}
                      onChange={(event) => setFormData({ ...formData, stock_quantity: event.target.value })}
                      className="h-11 bg-secondary border-border"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSubmit} className="flex-1 bg-gradient-primary hover:shadow-glow">
                    {editingProduct ? 'Zapisz zmiany' : 'Dodaj do sklepu'}
                  </Button>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><ShoppingBag className="w-8 h-8 text-primary" /><div><p className="text-2xl font-bold">{products.length}</p><p className="text-sm text-muted-foreground">Wszystkich produktów</p></div></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><Package className="w-8 h-8 text-green-400" /><div><p className="text-2xl font-bold">{products.filter((p) => p.active).length}</p><p className="text-sm text-muted-foreground">Widocznych w sklepie</p></div></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4"><div className="flex items-center gap-3"><ImagePlus className="w-8 h-8 text-blue-400" /><div><p className="text-2xl font-bold">{products.filter((p) => Array.isArray(p.images) && p.images.length > 0).length}</p><p className="text-sm text-muted-foreground">Ze zdjęciem</p></div></div></CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj produktu..." className="pl-12 h-11 bg-secondary border-border" />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : visibleProducts.length === 0 ? (
        <div className="text-center py-12"><Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Brak produktów</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => {
            const images = Array.isArray(product.images) ? product.images : [];
            const image = typeof images[0] === 'string' ? images[0] : '';
            return (
              <Card key={product.id} className="bg-card border-border overflow-hidden">
                <div className="aspect-video bg-secondary flex items-center justify-center overflow-hidden">
                  {image ? <img src={image} alt={product.name} className="w-full h-full object-cover" /> : <ImagePlus className="w-12 h-12 text-muted-foreground" />}
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{product.name}</h3>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <Badge variant={product.active ? 'default' : 'secondary'}>{product.active ? 'Widoczny' : 'Ukryty'}</Badge>
                  </div>
                  {product.description && <p className="text-sm text-muted-foreground line-clamp-3">{product.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Cena z kilograma</span>
                    <span className="font-semibold text-foreground">{product.price.toFixed(2)} zł/kg</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Ilość</span>
                    <span className="font-medium text-foreground">{product.stock_quantity} szt.</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(product)} className="flex-1"><Edit className="w-4 h-4 mr-1" />Edytuj</Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(product)}>{product.active ? 'Ukryj' : 'Pokaż'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteProduct(product)} className="text-destructive hover:bg-destructive/10"><Trash2 className="w-4 h-4" /></Button>
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
