'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Package, ShoppingCart, Weight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Product } from '@/lib/types/database';
import { useCart } from '@/lib/cart-provider';
import { toast } from 'sonner';

export default function ProductPage({ params }: { params: { slug: string } }) {
  const { addToCart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      const { data, error: queryError } = await supabase.from('products').select('*').eq('slug', params.slug).eq('active', true).maybeSingle();
      const foundProduct = data as Product | null;
      setProduct(foundProduct);
      setError(Boolean(queryError));
      const productImages = foundProduct && Array.isArray(foundProduct.images) ? foundProduct.images as string[] : [];
      setSelectedImage(productImages[0] || '');
      if (foundProduct?.category_id) {
        const { data: category } = await supabase.from('categories').select('name').eq('id', foundProduct.category_id).maybeSingle();
        setCategoryName(category?.name || '');
      }
      setLoading(false);
    };
    fetchProduct();
  }, [params.slug]);

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (error) return <div className="min-h-[60vh] flex items-center justify-center px-4 text-center"><div><Package className="mx-auto mb-4 h-14 w-14 text-destructive" /><h1 className="text-2xl font-bold">Nie udało się pobrać produktu</h1><p className="mt-2 text-muted-foreground">Odśwież stronę i spróbuj ponownie.</p></div></div>;
  if (!product) return <div className="min-h-[60vh] flex items-center justify-center px-4 text-center"><div><Package className="mx-auto mb-4 h-14 w-14 text-muted-foreground" /><h1 className="text-2xl font-bold">Produkt niedostępny</h1><Button asChild className="mt-6"><Link href="/sklep">Wróć do sklepu</Link></Button></div></div>;

  const images = Array.isArray(product.images) ? product.images as string[] : [];
  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/sklep" className="mb-8 inline-flex items-center gap-2 text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Wróć do sklepu</Link>
      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-secondary">
            {selectedImage ? <img src={selectedImage} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Package className="h-24 w-24 text-muted-foreground" /></div>}
          </div>
          {images.length > 1 && <div className="mt-4 grid grid-cols-4 gap-3">{images.map((image) => <button key={image} type="button" onClick={() => setSelectedImage(image)} className={`aspect-square overflow-hidden rounded-lg border-2 bg-secondary ${selectedImage === image ? 'border-primary' : 'border-transparent'}`}><img src={image} alt="" className="h-full w-full object-cover" /></button>)}</div>}
        </div>
        <div className="flex flex-col justify-center">
          {categoryName && <p className="mb-2 text-sm font-medium text-primary">{categoryName}</p>}
          <p className="mb-2 text-sm text-muted-foreground">SKU: {product.sku}</p>
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">{product.name}</h1>
          <p className="mb-6 text-lg text-muted-foreground">{product.short_description || product.description}</p>
          <div className="mb-6 flex items-baseline gap-3"><span className="text-3xl font-bold text-primary">{Number(product.price).toFixed(2)} zł</span>{product.compare_price && <span className="text-lg text-muted-foreground line-through">{Number(product.compare_price).toFixed(2)} zł</span>}</div>
          <p className="mb-6 text-sm text-muted-foreground">{product.stock_quantity > 0 ? `Dostępne: ${product.stock_quantity} szt.` : 'Produkt chwilowo niedostępny'}</p>
          {product.weight_grams && <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><Weight className="h-4 w-4 text-primary" />Waga: {product.weight_grams} g</p>}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button disabled={product.stock_quantity <= 0} onClick={() => { addToCart(product); toast.success('Dodano do koszyka', { description: product.name }); }}><ShoppingCart className="mr-2 h-4 w-4" />Dodaj do koszyka</Button>
            <Button asChild variant="outline"><Link href={`/kontakt?temat=produkt&produkt=${encodeURIComponent(product.sku)}`}><MessageCircle className="mr-2 h-4 w-4" />Zapytaj o produkt</Link></Button>
          </div>
          {product.description && <div className="mt-10 border-t pt-6 whitespace-pre-wrap text-muted-foreground">{product.description}</div>}
        </div>
      </div>
    </div>
  );
}
