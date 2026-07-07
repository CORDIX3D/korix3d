'use client';

import Link from 'next/link';
import { Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCart } from '@/lib/cart-provider';

export default function CartPage() {
  const { items, subtotal, hydrated, removeFromCart, updateQuantity, clearCart } = useCart();

  if (!hydrated) return <div className="min-h-[70vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (items.length === 0) {
    return <div className="min-h-[70vh] flex items-center justify-center px-4 py-16"><div className="max-w-lg text-center"><div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10"><ShoppingCart className="h-10 w-10 text-primary" /></div><h1 className="mb-3 text-3xl font-bold">Twój koszyk jest pusty</h1><p className="mb-8 text-muted-foreground">Przejdź do sklepu i wybierz produkty, które chcesz zamówić.</p><Button asChild><Link href="/sklep">Przejdź do sklepu</Link></Button></div></div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-3xl font-bold sm:text-4xl">Koszyk</h1><p className="mt-2 text-muted-foreground">Sprawdź produkty i ich ilości.</p></div>
        <Button variant="outline" onClick={clearCart}><Trash2 className="mr-2 h-4 w-4" />Wyczyść koszyk</Button>
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <Link href={`/sklep/${item.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">{item.image ? <img src={item.image} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-10 w-10 text-muted-foreground" /></div>}</div>
                <div className="min-w-0"><h2 className="font-semibold sm:text-lg">{item.name}</h2><p className="mt-1 text-xs text-muted-foreground">SKU: {item.sku}</p><p className="mt-2 font-bold text-primary">{item.price.toFixed(2)} zł</p></div>
              </Link>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <div className="flex items-center rounded-lg border">
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 hover:bg-secondary" aria-label={`Zmniejsz ilość ${item.name}`}><Minus className="h-4 w-4" /></button>
                  <span className="w-10 text-center text-sm font-medium">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stockQuantity} className="p-2 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Zwiększ ilość ${item.name}`}><Plus className="h-4 w-4" /></button>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} aria-label={`Usuń ${item.name} z koszyka`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
        <Card className="h-fit lg:sticky lg:top-24"><CardContent className="p-6"><h2 className="mb-6 text-xl font-semibold">Podsumowanie</h2><div className="mb-6 flex items-center justify-between border-b pb-4"><span className="text-muted-foreground">Wartość produktów</span><span className="text-2xl font-bold">{subtotal.toFixed(2)} zł</span></div><p className="mb-6 text-sm text-muted-foreground">Koszt dostawy i ostateczne warunki potwierdzimy przed realizacją.</p><Button asChild className="w-full"><Link href="/checkout">Przejdź do zamówienia</Link></Button><Button asChild variant="outline" className="mt-3 w-full"><Link href="/sklep">Kontynuuj zakupy</Link></Button></CardContent></Card>
      </div>
    </div>
  );
}
