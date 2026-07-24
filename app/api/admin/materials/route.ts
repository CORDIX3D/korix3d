import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isLegacyMaterialsSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String(error.message || '') : '';
  return ['price_per_kg', 'properties', 'slug', 'available', 'updated_at'].some((column) =>
    message.includes(column)
  );
}

function removeUnsupportedMaterialFields<T extends Record<string, unknown>>(data: T, error: unknown) {
  if (!error || typeof error !== 'object') return data;
  const message = 'message' in error ? String(error.message || '') : '';
  const nextData = { ...data };

  for (const column of ['price_per_kg', 'properties', 'slug', 'available', 'updated_at']) {
    if (message.includes(column)) {
      delete nextData[column];
    }
  }

  return nextData;
}

async function findExistingMaterial(
  admin: SupabaseClient,
  name: string,
  id?: string
) {
  const baseQuery = id
    ? admin.from('materials').select('id, slug').eq('id', id).maybeSingle()
    : admin.from('materials').select('id, slug').ilike('name', name).limit(1).maybeSingle();

  const { data, error } = await baseQuery;
  if (!error) return { id: data?.id || '', slug: data?.slug || '' };
  if (!isLegacyMaterialsSchemaError(error)) throw error;

  const fallbackQuery = id
    ? admin.from('materials').select('id').eq('id', id).maybeSingle()
    : admin.from('materials').select('id').ilike('name', name).limit(1).maybeSingle();

  const fallback = await fallbackQuery;
  if (fallback.error) throw fallback.error;
  return { id: fallback.data?.id || '', slug: '' };
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

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const admin = context.client;
    const form = await request.formData();
    const id = String(form.get('id') || '').trim();
    const name = String(form.get('name') || '').trim().toUpperCase();
    const description = String(form.get('description') || '').trim() || null;

    if (!name) {
      return NextResponse.json({ error: 'Podaj rodzaj materiału, np. PLA, PETG albo ABS.' }, { status: 400 });
    }

    let materialId = id;
    let existingSlug = '';

    const existingMaterial = await findExistingMaterial(admin, name, materialId || undefined);
    materialId = materialId || existingMaterial.id;
    existingSlug = existingMaterial.slug;

    const materialData = {
      name,
      slug: existingSlug || `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      description,
      available: true,
      updated_at: new Date().toISOString(),
    };

    if (materialId) {
      let { error } = await admin.from('materials').update(materialData).eq('id', materialId);
      if (error && isLegacyMaterialsSchemaError(error)) {
        const retry = await admin
          .from('materials')
          .update(removeUnsupportedMaterialFields(materialData, error))
          .eq('id', materialId);
        error = retry.error;
      }
      if (error) throw error;
    } else {
      const insertData = {
        ...materialData,
        price_per_kg: 0,
        properties: {},
      };

      let { data, error } = await admin
        .from('materials')
        .insert(insertData)
        .select('id')
        .single();

      if (error && isLegacyMaterialsSchemaError(error)) {
        const retry = await admin
          .from('materials')
          .insert(removeUnsupportedMaterialFields(insertData, error))
          .select('id')
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;
      if (!data) throw new Error('Supabase nie zwrócił identyfikatora zapisanego materiału.');
      materialId = data.id;
    }

    return NextResponse.json({ success: true, materialId });
  } catch (error) {
    console.error('Admin material save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać typu materiału.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const { id, available } = await request.json();

    if (!id || typeof available !== 'boolean') {
      return NextResponse.json({ error: 'Brak poprawnych danych materiału.' }, { status: 400 });
    }

    const updateData = { available, updated_at: new Date().toISOString() };
    let { error } = await context.client
      .from('materials')
      .update(updateData)
      .eq('id', id);

    if (error && isLegacyMaterialsSchemaError(error)) {
      const retry = await context.client
        .from('materials')
        .update(removeUnsupportedMaterialFields(updateData, error))
        .eq('id', id);
      error = retry.error;
    }

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin material update error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zaktualizować typu materiału.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Brak identyfikatora materiału.' }, { status: 400 });
    }

    const { error } = await context.client.from('materials').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin material delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się usunąć typu materiału.' },
      { status: 500 }
    );
  }
}
