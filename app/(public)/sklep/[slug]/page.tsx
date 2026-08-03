import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft, Package, Weight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProductPurchaseActions } from '@/components/shop/product-purchase-actions';
import type { Product } from '@/lib/types/database';
import { OptimizedImage } from '@/components/ui/optimized-image';
import { PUBLIC_PRODUCT_SELECT } from '@/lib/public-product';
import { absoluteSiteUrl, breadcrumbJsonLd, seoDescription, serializeJsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const getProduct = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select(PUBLIC_PRODUCT_SELECT)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error('Nie udało się pobrać produktu.');
  return data as Product | null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const description = seoDescription(product.meta_description || product.short_description || product.description, 'Produkt do druku 3D dostępny w sklepie KORIX3D.');
  const canonical = `/sklep/${encodeURIComponent(slug)}`;
  const images = Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === 'string') : [];
  return {
    title: product.meta_title || product.name,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', url: canonical, title: product.meta_title || product.name, description, images },
    twitter: { card: 'summary_large_image', title: product.meta_title || product.name, description, images },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const supabase = await createClient();
  const images = Array.isArray(product.images) ? product.images as string[] : [];
  const categoryResult = product.category_id
    ? await supabase.from('categories').select('name').eq('id', product.category_id).maybeSingle()
    : { data: null, error: null };
  if (categoryResult.error) {
    throw new Error('Nie udało się pobrać kategorii produktu.');
  }
  const category = categoryResult.data;
  const description = seoDescription(product.short_description || product.description, 'Produkt do druku 3D dostępny w sklepie KORIX3D.');
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    image: images,
    sku: product.sku,
    url: absoluteSiteUrl(`/sklep/${encodeURIComponent(product.slug)}`),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'PLN',
      price: Number(product.price).toFixed(2),
      availability: product.stock_quantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: absoluteSiteUrl(`/sklep/${encodeURIComponent(product.slug)}`),
    },
  };
  const breadcrumbs = breadcrumbJsonLd([
    { name: 'Strona główna', path: '/' },
    { name: 'Sklep', path: '/sklep' },
    { name: product.name, path: `/sklep/${encodeURIComponent(product.slug)}` },
  ]);

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(productJsonLd) }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /><div className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <Link href="/sklep" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do sklepu</Link>
    <div className="grid gap-10 lg:grid-cols-2">
      <div><div className="aspect-square overflow-hidden rounded-2xl bg-secondary">{images[0] ? <OptimizedImage src={images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-24 w-24 text-muted-foreground" /></div>}</div>{images.length > 1 && <div className="mt-4 grid grid-cols-4 gap-3">{images.slice(1).map((image) => <div key={image} className="aspect-square overflow-hidden rounded-lg bg-secondary"><OptimizedImage src={image} alt={`${product.name} – dodatkowe zdjęcie`} className="h-full w-full object-cover" sizes="25vw" /></div>)}</div>}</div>
      <div className="flex flex-col justify-center">{category?.name && <p className="mb-2 text-sm font-medium text-primary">{category.name}</p>}<p className="mb-2 text-sm text-muted-foreground">SKU: {product.sku}</p><h1 className="mb-4 text-3xl font-bold sm:text-4xl">{product.name}</h1><p className="mb-6 text-lg text-muted-foreground">{product.short_description || product.description}</p><div className="mb-6 flex items-baseline gap-3"><span className="text-3xl font-bold text-primary">{Number(product.price).toFixed(2)} zł</span>{product.compare_price && <span className="text-lg text-muted-foreground line-through">{Number(product.compare_price).toFixed(2)} zł</span>}</div><p className="mb-6 text-sm text-muted-foreground">{product.stock_quantity > 0 ? `Dostępne: ${product.stock_quantity} szt.` : 'Produkt chwilowo niedostępny'}</p>{product.weight_grams && <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><Weight className="h-4 w-4 text-primary" />Waga: {product.weight_grams} g</p>}<ProductPurchaseActions product={product} />{product.description && <div className="mt-10 whitespace-pre-wrap border-t pt-6 text-muted-foreground">{product.description}</div>}</div>
    </div>
  </div></>;
}
