'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Search,
  SlidersHorizontal,
  Grid3X3,
  List,
  Star,
  ShoppingCart,
  Package,
  Filter,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Category, Product } from '@/lib/types/database';
import { useCart } from '@/lib/cart-provider';
import { toast } from 'sonner';

const sortOptions = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'price_asc', label: 'Cena: od najniższej' },
  { value: 'price_desc', label: 'Cena: od najwyższej' },
  { value: 'available', label: 'Największa dostępność' },
];

export default function ShopPage() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('k');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('active', true)
        .order('sort_order');
      if (data) setCategories(data as Category[]);
      if (categoriesError) setError(true);
      setCategoriesLoaded(true);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categoriesLoaded && selectedCategory && !categories.some((category) => category.slug === selectedCategory)) {
      setSelectedCategory(null);
    }
  }, [categories, categoriesLoaded, selectedCategory]);

  const fetchProducts = useCallback(async () => {
    if (!categoriesLoaded) return;
    setLoading(true);
    setError(false);
    let query = supabase
      .from('products')
      .select('*')
      .eq('active', true);

    if (selectedCategory) {
      const category = categories.find((c) => c.slug === selectedCategory);
      if (category) {
        query = query.eq('category_id', category.id);
      }
    }

    if (debouncedSearch) {
      const safeSearch = debouncedSearch.replace(/[%_,]/g, ' ');
      query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
    }

    // Sorting
    switch (sortBy) {
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      case 'available':
        query = query.order('stock_quantity', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error: queryError } = await query.limit(24);

    if (data) setProducts(data);
    if (queryError) setError(true);
    setLoading(false);
  }, [categories, categoriesLoaded, debouncedSearch, selectedCategory, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory(null);
    setSortBy('newest');
  };

  const hasActiveFilters = search || selectedCategory;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-primary/10 to-transparent py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
              Sklep
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Filamenty, akcesoria i produkty do druku 3D
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Filters - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <Card className="bg-card border-border sticky top-24">
              <CardContent className="p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filtry
                </h3>

                {/* Categories */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-foreground mb-3">Kategorie</h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        !selectedCategory
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      Wszystkie
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.slug)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCategory === cat.slug
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Wyczyść filtry
                  </Button>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj produktów..."
                  className="pl-12 h-12 bg-card border-border"
                />
              </div>

              {/* Sort & View Controls */}
              <div className="flex gap-2">
                {/* Mobile Filter Button */}
                <Sheet open={showFilters} onOpenChange={setShowFilters}>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button variant="outline" size="icon" className="h-12 w-12">
                      <SlidersHorizontal className="w-5 h-5" />
                      <span className="sr-only">Otwórz filtry</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="bg-card">
                    <SheetHeader>
                      <SheetTitle>Filtry</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6">
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3">Kategorie</h4>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedCategory(null);
                              setShowFilters(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              !selectedCategory
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-secondary'
                            }`}
                          >
                            Wszystkie
                          </button>
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() => {
                                setSelectedCategory(cat.slug);
                                setShowFilters(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                selectedCategory === cat.slug
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-secondary'
                              }`}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      {hasActiveFilters && <Button variant="outline" onClick={() => { clearFilters(); setShowFilters(false); }} className="w-full">Wyczyść filtry</Button>}
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="flex-1 sm:w-48 h-12 bg-card border-border">
                    <SelectValue placeholder="Sortuj" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* View Mode */}
                <div className="hidden sm:flex border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('grid')}
                    aria-label="Widok kafelków"
                    className={`p-3 transition-colors ${
                      viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
                    }`}
                  >
                    <Grid3X3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    aria-label="Widok listy"
                    className={`p-3 transition-colors ${
                      viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filters Tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {categories.find((c) => c.slug === selectedCategory)?.name}
                    <button onClick={() => setSelectedCategory(null)}>
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                )}
                {search && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    Szukasz: {search}
                    <button onClick={() => setSearch('')} aria-label="Usuń wyszukiwanie"><X className="w-4 h-4" /></button>
                  </span>
                )}
              </div>
            )}

            {/* Products Grid */}
            {loading ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nie udało się pobrać produktów</h3>
                <p className="text-muted-foreground mb-4">Sprawdź połączenie i spróbuj ponownie.</p>
                <Button onClick={fetchProducts}>Spróbuj ponownie</Button>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Brak produktów
                </h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters ? 'Spróbuj zmienić kryteria wyszukiwania.' : 'Obecnie nie ma aktywnych produktów w sklepie.'}
                </p>
                {hasActiveFilters && <Button onClick={clearFilters}>Wyczyść filtry</Button>}
              </div>
            ) : (
              <div
                className={`grid gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1'
                }`}
              >
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}

            {/* Results Count */}
            {!loading && products.length > 0 && (
              <div className="mt-8 text-center">
                <p className="text-muted-foreground">
                  Wyświetlono {products.length} produktów
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  viewMode,
}: {
  product: Product;
  viewMode: 'grid' | 'list';
}) {
  const { addToCart } = useCart();
  const images = product.images as string[] || [];
  const mainImage = images[0] || null;

  if (viewMode === 'list') {
    return (
      <Link href={`/sklep/${product.slug}`}>
        <Card className="bg-card border-border hover:border-primary/50 transition-all overflow-hidden">
          <CardContent className="p-0 flex flex-col sm:flex-row">
            <div className="w-full aspect-video sm:aspect-auto sm:w-48 sm:h-48 bg-secondary flex-shrink-0 relative">
              {mainImage ? (
                <OptimizedImage
                  src={mainImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.short_description || product.description}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xl sm:text-2xl font-bold text-primary">
                    {Number(product.price).toFixed(2)} zł
                  </p>
                  {product.compare_price && (
                    <p className="text-sm text-muted-foreground line-through">
                      {Number(product.compare_price).toFixed(2)} zł
                    </p>
                  )}
                  <Button size="sm" className="mt-3" disabled={product.stock_quantity <= 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); addToCart(product); toast.success('Dodano do koszyka', { description: product.name }); }}><ShoppingCart className="mr-2 h-4 w-4" />Do koszyka</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={`/sklep/${product.slug}`}>
      <Card
        className="bg-card border-border hover:border-primary/50 transition-all overflow-hidden group"
      >
        <div className="relative aspect-square bg-secondary overflow-hidden">
          {mainImage ? (
            <OptimizedImage
              src={mainImage}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground" />
            </div>
          )}

          {/* Quick Actions */}
          <div
            className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          >
            <button type="button" disabled={product.stock_quantity <= 0} onClick={(event) => { event.preventDefault(); event.stopPropagation(); addToCart(product); toast.success('Dodano do koszyka', { description: product.name }); }} className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              {product.stock_quantity > 0 ? 'Dodaj do koszyka' : 'Brak w magazynie'}
            </button>
          </div>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            {product.featured && (
              <span className="px-2 py-1 bg-primary text-white text-xs rounded font-medium">
                Polecane
              </span>
            )}
            {product.compare_price && (
              <span className="px-2 py-1 bg-destructive text-white text-xs rounded font-medium">
                Promocja
              </span>
            )}
          </div>
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-foreground mb-1 line-clamp-1">
            {product.name}
          </h3>
          {product.short_description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {product.short_description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-primary">
                {Number(product.price).toFixed(2)} zł
              </p>
              {product.compare_price && (
                <p className="text-xs text-muted-foreground line-through">
                  {Number(product.compare_price).toFixed(2)} zł
                </p>
              )}
            </div>
            {product.stock_quantity > 0 ? (
              <span className="text-xs text-green-400">W magazynie</span>
            ) : (
              <span className="text-xs text-destructive">Brak</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
