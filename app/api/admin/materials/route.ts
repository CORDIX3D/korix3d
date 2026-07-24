import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
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
  return message.includes('price_per_kg') || message.includes('properties');
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

    if (!materialId) {
      const { data: existing, error } = await admin
        .from('materials')
        .select('id, slug')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      materialId = existing?.id || '';
      existingSlug = existing?.slug || '';
    } else {
      const { data: existing, error } = await admin
        .from('materials')
        .select('slug')
        .eq('id', materialId)
        .maybeSingle();

      if (error) throw error;
      existingSlug = existing?.slug || '';
    }

    const materialData = {
      name,
      slug: existingSlug || `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      description,
      available: true,
      updated_at: new Date().toISOString(),
    };

    if (materialId) {
      const { error } = await admin.from('materials').update(materialData).eq('id', materialId);
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
        const retry = await admin.from('materials').insert(materialData).select('id').single();
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

    const { error } = await context.client
      .from('materials')
      .update({ available, updated_at: new Date().toISOString() })
      .eq('id', id);

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
