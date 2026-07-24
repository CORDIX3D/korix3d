import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

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

function validateTable(table: unknown) {
  const tableName = String(table || '').trim();
  return ALLOWED_TABLES.has(tableName) ? tableName : null;
}

function normalizePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return payload as AdminCrudPayload;
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

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await request.json();
    const table = validateTable(body.table);
    const normalizedPayload = normalizePayload(body.payload);
    const id = String(body.id || '').trim();

    if (!table || !normalizedPayload) {
      return NextResponse.json({ error: 'Niepoprawne dane zapisu.' }, { status: 400 });
    }

    const payload = preparePayload(table, normalizedPayload);
    if (!payload) {
      return NextResponse.json({ error: 'Nazwa kategorii jest wymagana.' }, { status: 400 });
    }

    const result = id
      ? await context.client.from(table).update(payload).eq('id', id)
      : await context.client.from(table).insert([payload]);

    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin CRUD save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać pozycji.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const body = await request.json();
    const table = validateTable(body.table);
    const id = String(body.id || '').trim();
    const softDeleteField = body.softDeleteField ? String(body.softDeleteField) : '';

    if (!table || !id) {
      return NextResponse.json({ error: 'Brak danych pozycji do usunięcia.' }, { status: 400 });
    }

    let result;

    if (softDeleteField) {
      if (!ALLOWED_SOFT_DELETE_FIELDS.has(softDeleteField)) {
        result = { error: new Error('Niepoprawne pole dezaktywacji.') };
      } else {
        result = await context.client
          .from(table)
          .update({ [softDeleteField]: false, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (result.error && isMissingUpdatedAtError(result.error)) {
          result = await context.client
            .from(table)
            .update({ [softDeleteField]: false })
            .eq('id', id);
        }
      }
    } else {
      result = await context.client.from(table).delete().eq('id', id);
    }

    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin CRUD delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się usunąć pozycji.' },
      { status: 500 }
    );
  }
}
