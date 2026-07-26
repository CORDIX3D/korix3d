'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Heart, Package, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OptimizedImage } from '@/components/ui/optimized-image';
import {
  PanelEmpty,
  PanelError,
  PanelHeading,
  PanelLoading,
} from '@/components/customer/panel-state';
import { supabase } from '@/lib/supabase/client';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/public-product';
import { useCart } from '@/lib/cart-provider';
import { useWishlist } from '@/lib/wishlist-provider';
import type { Product } from '@/lib/types/database';

export function CustomerWishlist() {
  const {
    productIds,
    loading: wishlistLoading,
    error: wishlistError,
    toggle,
    refresh,
  } = useWishlist();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');

  const loadProducts = useCallback(async () => {
    if (wishlistLoading) return;
    if (productIds.length === 0) {
      setProducts([]);
      setProductsError('');
      setProductsLoading(false);
      return;
    }

    setProductsLoading(true);
    setProductsError('');
    try {
      const { data, error } = await supabase
        .from('products')
        .select(PUBLIC_PRODUCT_SELECT)
        .in('id', productIds)
        .eq('active', true);

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch {
      setProducts([]);
      setProductsError('Nie udało się pobrać zapisanych produktów. Spróbuj ponownie.');
    } finally {
      setProductsLoading(false);
    }
  }, [productIds, wishlistLoading]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const sortedProducts = useMemo(() => {
    const positions = new Map(productIds.map((id, index) => [id, index]));
    return products
      .filter((product) => productIds.includes(product.id))
      .sort((left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0));
  }, [productIds, products]);

  const retry = async () => {
    await refresh();
    await loadProducts();
  };

  const removeProduct = async (product: Product) => {
    const result = await toggle(product.id);
    if (result === 'removed') {
      toast.success('Usunięto z listy życzeń', { description: product.name });
    } else if (result === 'error') {
      toast.error('Nie udało się usunąć produktu');
    }
  };

  const addProductToCart = (product: Product) => {
    const price = Number(product.price);
    if (product.stock_quantity < 1 || !Number.isFinite(price) || price < 0) {
      toast.error('Produkt jest obecnie niedostępny');
      return;
    }
    addToCart(product);
    toast.success('Dodano do koszyka', { description: product.name });
  };

  const loading = wishlistLoading || productsLoading;
  const error = wishlistError || productsError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PanelHeading
          title="Lista życzeń"
          description="Produkty zapisane na później."
        />
        <Button type="button" variant="outline" onClick={retry} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Odśwież
        </Button>
      </div>

      {loading ? (
        <PanelLoading label="Pobieranie listy życzeń..." />
      ) : error ? (
        <PanelError message={error} onRetry={retry} />
      ) : sortedProducts.length === 0 ? (
        <PanelEmpty
          icon={Heart}
          title="Lista życzeń jest pusta"
          description="W sklepie wybierz ikonę serca przy produkcie, aby zapisać go na później."
          actionLabel="Przejdź do sklepu"
          actionHref="/sklep"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedProducts.map((product) => {
            const images = Array.isArray(product.images) ? product.images as string[] : [];
            const available = product.stock_quantity > 0
              && Number.isFinite(Number(product.price))
              && Number(product.price) >= 0;

            return (
              <Card key={product.id} className="overflow-hidden">
                <Link href={`/sklep/${product.slug}`} className="block aspect-video bg-secondary">
                  {images[0] ? (
                    <OptimizedImage
                      src={images[0]}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center">
                      <Package className="h-14 w-14 text-muted-foreground" />
                    </span>
                  )}
                </Link>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <Link href={`/sklep/${product.slug}`} className="font-semibold hover:text-primary">
                      {product.name}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {product.short_description || product.description || 'Produkt KORIX3D'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-bold text-primary">
                      {Number(product.price).toFixed(2)} zł
                    </p>
                    <span className={`text-xs ${available ? 'text-green-400' : 'text-destructive'}`}>
                      {available ? 'W magazynie' : 'Niedostępny'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => addProductToCart(product)}
                      disabled={!available}
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Do koszyka
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => void removeProduct(product)}
                      aria-label={`Usuń ${product.name} z listy życzeń`}
                    >
                      <Trash2 className="h-4 w-4" />
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
