import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type FilamentPayload = {
  id?: string;
  brand?: string;
  material_id?: string | null;
  material_name?: string;
  color?: string;
  color_hex?: string | null;
  image_url?: string | null;
  price_per_kg?: number | null;
  original_weight_grams?: number | null;
  remaining_weight_grams?: number;
  price_paid?: number | null;
  min_weight_grams?: number | null;
  location?: string | null;
  notes?: string | null;
};

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

function validatePayload(payload: FilamentPayload) {
  const brand = String(payload.brand || '').trim();
  const materialName = String(payload.material_name || '').trim();
  const color = String(payload.color || '').trim();
  const originalWeight = Number(payload.original_weight_grams);
  const remainingWeight = Number(payload.remaining_weight_grams);
  const minimumWeight = Number(payload.min_weight_grams ?? 0);

  if (!brand || !materialName || !color) {
    return 'Marka, materiał i kolor są wymagane.';
  }

  if (
    !Number.isFinite(originalWeight) ||
    originalWeight <= 0 ||
    !Number.isFinite(remainingWeight) ||
    remainingWeight < 0 ||
    remainingWeight > originalWeight ||
    !Number.isFinite(minimumWeight) ||
    minimumWeight < 0
  ) {
    return 'Sprawdź wagę początkową, pozostałą oraz próg minimalny.';
  }

  if (payload.price_per_kg !== null && payload.price_per_kg !== undefined && (!Number.isFinite(Number(payload.price_per_kg)) || Number(payload.price_per_kg) < 0)) {
    return 'Cena za kilogram musi być liczbą większą lub równą 0 albo pozostać pusta.';
  }

  if (payload.price_paid !== null && payload.price_paid !== undefined && (!Number.isFinite(Number(payload.price_paid)) || Number(payload.price_paid) < 0)) {
    return 'Cena zakupu musi być liczbą większą lub równą 0 albo pozostać pusta.';
  }

  return null;
}

function buildFilamentData(payload: FilamentPayload) {
  return {
    brand: String(payload.brand || '').trim(),
    material_id: payload.material_id || null,
    material_name: String(payload.material_name || '').trim(),
    color: String(payload.color || '').trim(),
    color_hex: payload.color_hex || '#FFFFFF',
    image_url: payload.image_url || null,
    price_per_kg: payload.price_per_kg ?? null,
    original_weight_grams: Number(payload.original_weight_grams),
    remaining_weight_grams: Number(payload.remaining_weight_grams),
    price_paid: payload.price_paid ?? null,
    min_weight_grams: Number(payload.min_weight_grams ?? 0),
    location: payload.location || null,
    notes: payload.notes || null,
    active: true,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const payload = (await request.json()) as FilamentPayload;
    const validationError = validatePayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const data = buildFilamentData(payload);
    const result = payload.id
      ? await context.client.from('filaments').update(data).eq('id', payload.id)
      : await context.client.from('filaments').insert([data]);

    if (result.error) throw result.error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin filament save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się zapisać filamentu.' },
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
      return NextResponse.json({ error: 'Brak identyfikatora filamentu.' }, { status: 400 });
    }

    const { error } = await context.client
      .from('filaments')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Admin filament delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się usunąć filamentu.' },
      { status: 500 }
    );
  }
}
