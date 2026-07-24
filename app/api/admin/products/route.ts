import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ProductPayload = {
  id?: string;
  sku?: string;
  name?: string;
  slug?: string;
  short_description?: string | null;
  description?: string | null;
  category_id?: string | null;
  price?: number;
  compare_price?: number | null;
  cost_price?: number | null;
  stock_quantity?: number;
  min_stock_quantity?: number | null;
  weight_grams?: number | null;
  images?: string[];
  active?: boolean;
  featured?: boolean;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function getAdminSupabaseClient() {
  const sessionClient = await createClient();
  const { data: auth } = await sessionClient.auth.getUser();

  if (!auth.user) {
    return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return { client: createSupabaseClient(url, serviceKey) };
  }

  return { client: sessionClient };
}

function validatePayload(payload: ProductPayload) {
  const sku = String(payload.sku || '').trim();
  const name = String(payload.name || '').trim();
  const price = Number(payload.price);
  const stockQuantity = Number(payload.stock_quantity ?? 0);
  const minStockQuantity = Number(payload.min_stock_quantity ?? 0);

  if (!sku || !name) {
    return 'SKU i nazwa produktu są wymagane.';
  }

  if (!Number.isFinite(price) || price <= 0) {
    return 'Cena produktu musi być większa od 0.';
  }

  if (!Number.isFinite(stockQuantity) || stockQuantity < 0 || !Number.isFinite(minStockQuantity) || minStockQuantity < 0) {
    return 'Stan magazynowy i minimum nie mogą być ujemne.';
  }

  for (const [label, value] of [
    ['Cena porównawcza', payload.compare_price],
    ['Koszt', payload.cost_price],
    ['Waga', payload.weight_grams],
  ] as const) {
    if (value !== null && value !== undefined && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
      return `${label} nie może być ujemna.`;
    }
  }

  return null;
}

function buildProductData(payload: ProductPayload) {
  const name = String(payload.name || '').trim();
  const imageList = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];

  return {
    sku: String(payload.sku || '').trim(),
    name,
    slug: String(payload.slug || '').trim() || slugify(name),
    short_description: payload.short_description || null,
    description: payload.description || null,
    category_id: payload.category_id || null,
    price: Number(payload.price),
    compare_price: payload.compare_price ?? null,
    cost_price: payload.cost_price ?? null,
    stock_quantity: Number(payload.stock_quantity ?? 0),
    min_stock_quantity: payload.min_stock_quantity ?? 0,
    weight_grams: payload.weight_grams ?? null,
    images: imageList,
    dimensions: {},
    active: payload.active ?? true,
    featured: payload.featured ?? false,
    updated_at: new Date().toISOString(),
  };
}

function isLegacyProductsSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String(error.message || '') : '';
  return message.includes('dimensions') || message.includes('featured');
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const payload = (await request.json()) as ProductPayload;
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const productData = buildProductData(payload);
    const writeData = payload.id ? productData : { ...productData, created_at: new Date().toISOString() };

    let result = payload.id
      ? await context.client.from('products').update(writeData).eq('id', payload.id)
      : await context.client.from('products').insert([writeData]);

    if (result.error && isLegacyProductsSchemaError(result.error)) {
      const legacyData = { ...writeData } as Record<string, unknown>;
      delete legacyData.dimensions;
      delete legacyData.featured;

      result = payload.id
        ? await context.client.from('products').update(legacyData).eq('id', payload.id)
        : await context.client.from('products').insert([legacyData]);
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin product save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać produktu.' },
      { status: 500 }
    );
  }
}
