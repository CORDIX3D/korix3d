import { NextRequest, NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { productPayloadSchema } from '@/lib/product-validation';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { code: '', message: '' };
  return {
    code: 'code' in error ? String(error.code || '') : '',
    message: 'message' in error ? String(error.message || '') : '',
  };
}

function productErrorResponse(error: unknown, action: 'zapisać' | 'usunąć') {
  const { code, message } = databaseDetails(error);

  if (
    ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code) ||
    message.includes('schema cache') ||
    (message.includes('column') && message.includes('does not exist'))
  ) {
    return NextResponse.json(
      { error: 'Baza Supabase wymaga zastosowania najnowszych migracji katalogu produktów.' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
    );
  }

  if (code === '23505') {
    return NextResponse.json(
      { error: 'Produkt z takim SKU lub adresem URL już istnieje.' },
      { status: 409 }
    );
  }

  if (code === '23503') {
    return NextResponse.json(
      { error: 'Wybrana kategoria nie istnieje albo produkt jest powiązany z zamówieniem.' },
      { status: 409 }
    );
  }

  if (['23514', '22003', '22P02'].includes(code)) {
    return NextResponse.json(
      { error: 'Jedna z wartości produktu ma niepoprawny format.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: `Nie udało się ${action} produktu.` },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const parsed = productPayloadSchema.safeParse(
      await readJsonObject(request, 64 * 1024)
    );
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      const messages: Record<string, string> = {
        sku: 'SKU może zawierać tylko litery, cyfry, kropki, myślniki i podkreślenia.',
        slug: 'Adres URL produktu ma niepoprawny format.',
        compare_price: 'Cena przekreślona musi być większa od ceny sprzedaży.',
        expected_updated_at: 'Odśwież listę produktów przed ponowną edycją.',
        images: 'Produkt może mieć maksymalnie 8 poprawnych adresów zdjęć.',
      };
      return NextResponse.json(
        { error: messages[String(field)] || 'Sprawdź dane produktu.' },
        { status: 400 }
      );
    }

    const { id, expected_updated_at: expectedUpdatedAt, ...productData } = parsed.data;
    const { data: duplicates, error: duplicateError } = await auth.context.adminClient
      .from('products')
      .select('id')
      .or(`sku.eq.${productData.sku},slug.eq.${productData.slug}`)
      .limit(3);

    if (duplicateError) throw duplicateError;
    if ((duplicates || []).some((product) => product.id !== id)) {
      return NextResponse.json(
        { error: 'Produkt z takim SKU lub adresem URL już istnieje.' },
        { status: 409 }
      );
    }

    const writeData = {
      ...productData,
      dimensions: {},
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { data, error } = await auth.context.adminClient
        .from('products')
        .update(writeData)
        .eq('id', id)
        .eq('updated_at', expectedUpdatedAt)
        .select('id, updated_at')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json(
          { error: 'Produkt został w międzyczasie zmieniony. Odśwież listę i spróbuj ponownie.' },
          { status: 409 }
        );
      }

      return NextResponse.json({ success: true, id: data.id, updatedAt: data.updated_at });
    }

    const { data, error } = await auth.context.adminClient
      .from('products')
      .insert(writeData)
      .select('id, updated_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id, updatedAt: data.updated_at });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin product save error:', error);
    return productErrorResponse(error, 'zapisać');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const id = request.nextUrl.searchParams.get('id') || '';
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator produktu.' }, { status: 400 });
    }

    const { data, error } = await auth.context.adminClient
      .from('products')
      .update({ active: false, featured: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Produkt nie istnieje.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin product delete error:', error);
    return productErrorResponse(error, 'usunąć');
  }
}
