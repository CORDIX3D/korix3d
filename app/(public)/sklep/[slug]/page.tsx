import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, Package, Weight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProductPurchaseActions } from '@/components/shop/product-purchase-actions';
import type { Product } from '@/lib/types/database';
import { OptimizedImage } from '@/components/ui/optimized-image';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = await createClient();
  const { data: product } = await supabase.from('products').select('name, short_description, description').eq('slug', params.slug).eq('active', true).maybeSingle();
  if (!product) notFound();
  return { title: product.name, description: product.short_description || product.description || undefined };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').select('*').eq('slug', params.slug).eq('active', true).maybeSingle();
  if (error) throw new Error('Nie udało się pobrać produktu.');
  if (!data) notFound();
  const product = data as Product;
  const images = Array.isArray(product.images) ? product.images as string[] : [];
  const { data: category } = product.category_id ? await supabase.from('categories').select('name').eq('id', product.category_id).maybeSingle() : { data: null };

  return <div className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <Link href="/sklep" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do sklepu</Link>
    <div className="grid gap-10 lg:grid-cols-2">
      <div><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{images[0] ? <OptimizedImage src={images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-24 w-24 text-muted-foreground" /></div>}</div>{images.length > 1 && <div className="mt-4 grid grid-cols-4 gap-3">{images.slice(1).map((image) => <div key={image} className="aspect-square overflow-hidden rounded-lg bg-secondary"><OptimizedImage src={image} alt={`${product.name} – dodatkowe zdjęcie`} className="h-full w-full object-cover" sizes="25vw" /></div>)}</div>}</div>
      <div className="flex flex-col justify-center">{category?.name && <p className="mb-2 text-sm font-medium text-primary">{category.name}</p>}<p className="mb-2 text-sm text-muted-foreground">SKU: {product.sku}</p><h1 className="mb-4 text-3xl font-bold sm:text-4xl">{product.name}</h1><p className="mb-6 text-lg text-muted-foreground">{product.short_description || product.description}</p><div className="mb-6 flex items-baseline gap-3"><span className="text-3xl font-bold text-primary">{Number(product.price).toFixed(2)} zł</span>{product.compare_price && <span className="text-lg text-muted-foreground line-through">{Number(product.compare_price).toFixed(2)} zł</span>}</div><p className="mb-6 text-sm text-muted-foreground">{product.stock_quantity > 0 ? `Dostępne: ${product.stock_quantity} szt.` : 'Produkt chwilowo niedostępny'}</p>{product.weight_grams && <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><Weight className="h-4 w-4 text-primary" />Waga: {product.weight_grams} g</p>}<ProductPurchaseActions product={product} />{product.description && <div className="mt-10 whitespace-pre-wrap border-t pt-6 text-muted-foreground">{product.description}</div>}</div>
    </div>
  </div>;
}
