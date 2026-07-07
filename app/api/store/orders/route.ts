import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const orderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(7).max(30),
  }),
  shippingAddress: z.object({
    street: z.string().trim().min(3).max(160),
    postalCode: z.string().trim().regex(/^\d{2}-\d{3}$/),
    city: z.string().trim().min(2).max(100),
    country: z.literal('PL'),
  }),
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Sprawdź dane kontaktowe, adres i zawartość koszyka.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Składanie zamówień jest chwilowo niedostępne.' }, { status: 503 });
    }

    const admin = createSupabaseClient(url, serviceKey);
    const productIds = [...new Set(parsed.data.items.map((item) => item.id))];
    const { data: products, error: productsError } = await admin
      .from('products')
      .select('id, name, sku, price, stock_quantity, active')
      .in('id', productIds);

    if (productsError || !products || products.length !== productIds.length) {
      return NextResponse.json({ error: 'Nie udało się potwierdzić produktów. Odśwież koszyk.' }, { status: 409 });
    }

    const lines = parsed.data.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product || !product.active || product.stock_quantity < item.quantity) {
        throw new Error('PRODUCT_UNAVAILABLE');
      }
      return {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: item.quantity,
        unit_price: Number(product.price),
        total: Number(product.price) * item.quantity,
      };
    });

    const subtotal = Number(lines.reduce((sum, line) => sum + line.total, 0).toFixed(2));
    const vatAmount = Number((subtotal * 23 / 123).toFixed(2));
    const orderNumber = `SK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    const { error: insertError } = await admin.from('store_orders').insert({
      order_number: orderNumber,
      user_id: auth.user?.id || null,
      status: 'pending',
      customer_email: parsed.data.customer.email,
      customer_name: parsed.data.customer.name,
      shipping_address: { ...parsed.data.shippingAddress, phone: parsed.data.customer.phone },
      billing_address: parsed.data.shippingAddress,
      subtotal,
      discount_amount: 0,
      shipping_cost: 0,
      vat_amount: vatAmount,
      total: subtotal,
      notes: JSON.stringify({ payment: 'manual_confirmation', lines }),
    });

    if (insertError) {
      console.error('Store order insert error:', insertError);
      return NextResponse.json({ error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' }, { status: 500 });
    }

    return NextResponse.json({ orderNumber });
  } catch (error) {
    if (error instanceof Error && error.message === 'PRODUCT_UNAVAILABLE') {
      return NextResponse.json({ error: 'Jeden z produktów jest niedostępny w wybranej ilości.' }, { status: 409 });
    }
    console.error('Store order API error:', error);
    return NextResponse.json({ error: 'Nie udało się złożyć zamówienia.' }, { status: 500 });
  }
}
