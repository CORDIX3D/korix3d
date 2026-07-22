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

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createClient();
    const { data: auth } = await sessionClient.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 });
    }

    const { data: profile } = await sessionClient
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'Brak konfiguracji Supabase na serwerze.' }, { status: 503 });
    }

    const admin = createSupabaseClient(url, serviceKey);
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
      const { data: existing } = await admin
        .from('materials')
        .select('id, slug')
        .ilike('name', name)
        .limit(1)
        .maybeSingle();

      materialId = existing?.id || '';
      existingSlug = existing?.slug || '';
    } else {
      const { data: existing } = await admin
        .from('materials')
        .select('slug')
        .eq('id', materialId)
        .maybeSingle();

      existingSlug = existing?.slug || '';
    }

    const materialData = {
      name,
      slug: existingSlug || `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      description,
      price_per_kg: 0,
      image_url: null,
      print_temp_min: null,
      print_temp_max: null,
      bed_temp_min: null,
      bed_temp_max: null,
      available: true,
      updated_at: new Date().toISOString(),
    };

    if (materialId) {
      const { error } = await admin.from('materials').update(materialData).eq('id', materialId);
      if (error) throw error;
    } else {
      const { data, error } = await admin.from('materials').insert(materialData).select('id').single();
      if (error) throw error;
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
