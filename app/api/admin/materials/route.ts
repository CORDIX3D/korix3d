import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MaterialPayload = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  available?: unknown;
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

function getDatabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== 'object') return { code: '', message: '' };
  return {
    code: 'code' in error ? String(error.code || '') : '',
    message: 'message' in error ? String(error.message || '') : '',
  };
}

function isMaterialsSchemaError(error: unknown) {
  const { code, message } = getDatabaseErrorDetails(error);
  return (
    ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(code) ||
    message.includes('schema cache') ||
    (message.includes('column') && message.includes('does not exist'))
  );
}

function materialErrorResponse(error: unknown, action: 'save' | 'update' | 'delete') {
  const { code } = getDatabaseErrorDetails(error);

  if (isMaterialsSchemaError(error)) {
    return NextResponse.json(
      {
        error:
          'Baza Supabase wymaga aktualizacji. Uruchom najnowsze migracje materiałów i filamentów.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
    );
  }

  if (code === '23503') {
    return NextResponse.json(
      { error: 'Nie można usunąć materiału używanego przez filament lub wycenę. Najpierw ukryj materiał.' },
      { status: 409 }
    );
  }

  if (code === '23505') {
    return NextResponse.json(
      { error: 'Materiał o tej nazwie już istnieje.' },
      { status: 409 }
    );
  }

  const messages = {
    save: 'Nie udało się zapisać typu materiału.',
    update: 'Nie udało się zaktualizować typu materiału.',
    delete: 'Nie udało się usunąć typu materiału.',
  };

  return NextResponse.json({ error: messages[action] }, { status: 500 });
}

async function findMaterialByName(client: SupabaseClient, name: string) {
  const { data, error } = await client
    .from('materials')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.id ? String(data.id) : '';
}

function normalizeMaterialPayload(body: MaterialPayload) {
  const id = String(body.id || '').trim();
  const name = String(body.name || '').trim().toUpperCase();
  const description = String(body.description || '').trim();

  if (id && !UUID_PATTERN.test(id)) {
    return { error: 'Nieprawidłowy identyfikator materiału.' } as const;
  }

  if (!name || name.length > 80) {
    return { error: 'Rodzaj materiału musi mieć od 1 do 80 znaków.' } as const;
  }

  if (description.length > 2000) {
    return { error: 'Opis materiału może mieć maksymalnie 2000 znaków.' } as const;
  }

  return { id, name, description: description || null } as const;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const normalized = normalizeMaterialPayload(
      (await readJsonObject(request, 8 * 1024)) as MaterialPayload
    );
    if ('error' in normalized) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }

    const { adminClient } = auth.context;
    const duplicateId = await findMaterialByName(adminClient, normalized.name);
    if (duplicateId && duplicateId !== normalized.id) {
      return NextResponse.json(
        { error: 'Materiał o tej nazwie już istnieje.' },
        { status: 409 }
      );
    }

    const materialData = {
      name: normalized.name,
      slug: slugify(normalized.name) || crypto.randomUUID().slice(0, 8),
      description: normalized.description,
      available: true,
      updated_at: new Date().toISOString(),
    };

    if (normalized.id) {
      const { data, error } = await adminClient
        .from('materials')
        .update(materialData)
        .eq('id', normalized.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return NextResponse.json({ error: 'Materiał nie istnieje.' }, { status: 404 });
      }

      return NextResponse.json({ success: true, materialId: data.id });
    }

    const { data, error } = await adminClient
      .from('materials')
      .insert({ ...materialData, price_per_kg: 0, properties: {} })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, materialId: data.id });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin material save error:', error);
    return materialErrorResponse(error, 'save');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const body = (await readJsonObject(request, 4 * 1024)) as MaterialPayload;
    const id = String(body.id || '').trim();

    if (!UUID_PATTERN.test(id) || typeof body.available !== 'boolean') {
      return NextResponse.json({ error: 'Brak poprawnych danych materiału.' }, { status: 400 });
    }

    const { data, error } = await auth.context.adminClient
      .from('materials')
      .update({ available: body.available, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Materiał nie istnieje.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin material update error:', error);
    return materialErrorResponse(error, 'update');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAdminApiContext();
    if (auth.response) return auth.response;

    const id = request.nextUrl.searchParams.get('id') || '';
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator materiału.' }, { status: 400 });
    }

    const { data, error } = await auth.context.adminClient
      .from('materials')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Materiał nie istnieje.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isSupabaseConfigurationError(error)) return adminApiUnavailableResponse();

    console.error('Admin material delete error:', error);
    return materialErrorResponse(error, 'delete');
  }
}
