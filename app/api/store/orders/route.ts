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
      return NextResponse.json(
        { error: 'Sprawdź dane kontaktowe, adres i zawartość koszyka.' },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Składanie zamówień jest chwilowo niedostępne.' },
        { status: 503 }
      );
    }

    const admin = createSupabaseClient(url, serviceKey);
    const orderNumber = `SK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    const { data: order, error: orderError } = await admin.rpc('create_store_order_with_stock', {
      p_user_id: auth.user?.id || null,
      p_order_number: orderNumber,
      p_customer_email: parsed.data.customer.email,
      p_customer_name: parsed.data.customer.name,
      p_shipping_address: {
        ...parsed.data.shippingAddress,
        phone: parsed.data.customer.phone,
      },
      p_billing_address: parsed.data.shippingAddress,
      p_items: parsed.data.items,
    });

    if (orderError) {
      if (['23514', 'P0002', '22023'].includes(orderError.code || '')) {
        return NextResponse.json(
          { error: 'Jeden z produktów jest niedostępny w wybranej ilości. Odśwież koszyk.' },
          { status: 409 }
        );
      }

      console.error('Store order transaction error:', orderError);
      return NextResponse.json(
        { error: 'Nie udało się zapisać zamówienia. Spróbuj ponownie.' },
        { status: 500 }
      );
    }

    const savedOrderNumber =
      typeof order === 'object' && order !== null && 'orderNumber' in order
        ? String(order.orderNumber || orderNumber)
        : orderNumber;

    return NextResponse.json({ orderNumber: savedOrderNumber });
  } catch (error) {
    console.error('Store order API error:', error);
    return NextResponse.json(
      { error: 'Nie udało się złożyć zamówienia.' },
      { status: 500 }
    );
  }
}
