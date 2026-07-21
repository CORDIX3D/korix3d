'use client';

import Link from 'next/link';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-provider';
import type { Product } from '@/lib/types/database';

export function ProductPurchaseActions({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const canAddToCart = product.stock_quantity > 0 && Number.isFinite(Number(product.price)) && Number(product.price) >= 0;

  return <div className="flex flex-col gap-3 sm:flex-row">
    <Button disabled={!canAddToCart} onClick={() => {
      if (!canAddToCart) {
        toast.error('Nie można dodać produktu', { description: 'Produkt jest niedostępny albo ma nieprawidłową cenę.' });
        return;
      }
      addToCart(product);
      toast.success('Dodano do koszyka', { description: product.name });
    }}>
      <ShoppingCart className="mr-2 h-4 w-4" />{canAddToCart ? 'Dodaj do koszyka' : 'Produkt niedostępny'}
    </Button>
    <Button asChild variant="outline">
      <Link href={`/kontakt?temat=produkt&produkt=${encodeURIComponent(product.sku)}`}>
        <MessageCircle className="mr-2 h-4 w-4" />Zapytaj o produkt
      </Link>
    </Button>
  </div>;
}
