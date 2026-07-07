'use client';

import Link from 'next/link';
import { MessageCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart-provider';
import type { Product } from '@/lib/types/database';

export function ProductPurchaseActions({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return <div className="flex flex-col gap-3 sm:flex-row">
    <Button disabled={product.stock_quantity <= 0} onClick={() => {
      addToCart(product);
      toast.success('Dodano do koszyka', { description: product.name });
    }}>
      <ShoppingCart className="mr-2 h-4 w-4" />Dodaj do koszyka
    </Button>
    <Button asChild variant="outline">
      <Link href={`/kontakt?temat=produkt&produkt=${encodeURIComponent(product.sku)}`}>
        <MessageCircle className="mr-2 h-4 w-4" />Zapytaj o produkt
      </Link>
    </Button>
  </div>;
}
