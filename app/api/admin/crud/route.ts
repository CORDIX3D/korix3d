import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

type AdminCrudPayload = Record<string, unknown>;

const ALLOWED_TABLES = new Set([
  'blog_posts',
  'categories',
  'contact_submissions',
  'discount_codes',
  'faq_items',
  'notifications',
  'orders_3d',
  'portfolio_items',
  'profiles',
  'settings',
  'store_orders',
]);

const ALLOWED_SOFT_DELETE_FIELDS = new Set(['active', 'published']);
const NON_DELETABLE_TABLES = new Set(['orders_3d', 'profiles', 'store_orders']);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function unavailableResponse() {
  return NextResponse.json(
    { error: 'Panel administratora jest chwilowo niedostępny.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    }
  );
}

function isAuthenticationServiceError(error: {
  name?: string;
  status?: number;
} | null) {
  return Boolean(
    error &&
      ((error.status ?? 0) >= 500 ||
        error.name === 'AuthRetryableFetchError' ||
        error.name === 'AuthUnknownError')
  );
}

async function getAdminSupabaseClient() {
  const sessionClient = await createClient();
  const { data: auth, error: authError } = await sessionClient.auth.getUser();

  if (isAuthenticationServiceError(authError)) {
    return { error: unavailableResponse() };
  }

  if (!auth.user) {
    return { error: NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await sessionClient
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin CRUD profile lookup error:', profileError);
    return { error: unavailableResponse() };
  }

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return { client: createSupabaseClient(url, serviceKey) };
  }

  return { client: sessionClient };
}

function validateTable(table: unknown) {
  const tableName = String(table || '').trim();
  return ALLOWED_TABLES.has(tableName) ? tableName : null;
}

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const entries = Object.entries(payload);
  if (
    entries.length > 50 ||
    entries.some(
      ([key]) =>
        !/^[a-z][a-z0-9_]*$/.test(key) ||
        ['__proto__', 'constructor', 'prototype'].includes(key)
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries) as AdminCrudPayload;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function preparePayload(table: string, payload: AdminCrudPayload) {
  const prepared = { ...payload };

  if (table === 'categories') {
    const name = String(prepared.name || '').trim();
    if (!name) return null;

    prepared.name = name;
    prepared.slug = String(prepared.slug || '').trim() || slugify(name) || crypto.randomUUID().slice(0, 8);
    prepared.active = prepared.active ?? true;
    prepared.sort_order = Number(prepared.sort_order ?? 0);
  }

  return prepared;
}

function isMissingUpdatedAtError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String(error.message || '') : '';
  return message.includes('updated_at');
}

function databaseErrorResponse(error: unknown, action: 'zapisać' | 'usunąć') {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code || '')
      : '';

  if (code === '23505') {
    return NextResponse.json(
      { error: 'Pozycja o takich danych już istnieje.' },
      { status: 409 }
    );
  }

  if (code === '23503') {
    return NextResponse.json(
      { error: 'Pozycja jest powiązana z innymi danymi i nie może zostać zmieniona w ten sposób.' },
      { status: 409 }
    );
  }

  if (['23514', '22023', '22P02'].includes(code)) {
    return NextResponse.json(
      { error: 'Jedna z wartości ma niepoprawny format.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: `Nie udało się ${action} pozycji.` },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await readJsonObject(request, 128 * 1024);
    const table = validateTable(body.table);
    const normalizedPayload = normalizePayload(body.payload);
    const id = String(body.id || '').trim();

    if (!table || !normalizedPayload || (id && !UUID_PATTERN.test(id))) {
      return NextResponse.json({ error: 'Niepoprawne dane zapisu.' }, { status: 400 });
    }

    const payload = preparePayload(table, normalizedPayload);
    if (!payload) {
      return NextResponse.json({ error: 'Nazwa kategorii jest wymagana.' }, { status: 400 });
    }

    const result = id
      ? await context.client.from(table).update(payload).eq('id', id).select('id')
      : await context.client.from(table).insert([payload]).select('id');

    if (result.error) {
      console.error('Admin CRUD database save error:', result.error);
      return databaseErrorResponse(result.error, 'zapisać');
    }

    if (!result.data?.length) {
      return NextResponse.json(
        { error: id ? 'Nie znaleziono pozycji do aktualizacji.' : 'Nie udało się utworzyć pozycji.' },
        { status: id ? 404 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    console.error('Admin CRUD save error:', error);
    return databaseErrorResponse(error, 'zapisać');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await readJsonObject(request, 8 * 1024);
    const table = validateTable(body.table);
    const id = String(body.id || '').trim();
    const softDeleteField = body.softDeleteField ? String(body.softDeleteField) : '';

    if (!table || !UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Brak danych pozycji do usunięcia.' }, { status: 400 });
    }

    if (NON_DELETABLE_TABLES.has(table)) {
      return NextResponse.json(
        { error: 'Tych danych nie można trwale usuwać w tym module.' },
        { status: 409 }
      );
    }

    let result;

    if (softDeleteField) {
      if (!ALLOWED_SOFT_DELETE_FIELDS.has(softDeleteField)) {
        result = { error: new Error('Niepoprawne pole dezaktywacji.') };
      } else {
        result = await context.client
          .from(table)
          .update({ [softDeleteField]: false, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('id');

        if (result.error && isMissingUpdatedAtError(result.error)) {
          result = await context.client
            .from(table)
            .update({ [softDeleteField]: false })
            .eq('id', id)
            .select('id');
        }
      }
    } else {
      result = await context.client.from(table).delete().eq('id', id).select('id');
    }

    if (result.error) {
      console.error('Admin CRUD database delete error:', result.error);
      return databaseErrorResponse(result.error, 'usunąć');
    }

    if (!result.data?.length) {
      return NextResponse.json(
        { error: 'Nie znaleziono pozycji do usunięcia.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    console.error('Admin CRUD delete error:', error);
    return databaseErrorResponse(error, 'usunąć');
  }
}
