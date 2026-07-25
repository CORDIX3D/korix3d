import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { isStaffRole } from '@/lib/admin-access';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const OPTIONAL_FILAMENT_COLUMNS = [
  'material_id',
  'color_hex',
  'image_url',
  'price_per_kg',
  'original_weight_grams',
  'price_paid',
  'min_weight_grams',
  'location',
  'notes',
  'active',
  'updated_at',
] as const;

function unavailableResponse() {
  return NextResponse.json(
    { error: 'Magazyn filamentów jest chwilowo niedostępny.' },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '60',
      },
    }
  );
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

  if (profileError) {
    console.error('Filament staff profile lookup error:', profileError);
    return { error: unavailableResponse() };
  }

  if (!isStaffRole(profile?.role)) {
    return { error: NextResponse.json({ error: 'Brak uprawnień pracownika.' }, { status: 403 }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    return { client: createServiceRoleClient(url, serviceKey, auth.user.id) };
  }

  return { client: sessionClient };
}

async function resolveMaterialName(client: SupabaseClient, payload: FilamentPayload) {
  const materialName = String(payload.material_name || '').trim();
  if (materialName || !payload.material_id) return materialName;

  const { data, error } = await client
    .from('materials')
    .select('name')
    .eq('id', payload.material_id)
    .maybeSingle();

  if (error) throw error;
  return String(data?.name || '').trim();
}

function validatePayload(payload: FilamentPayload, resolvedMaterialName: string) {
  const brand = String(payload.brand || '').trim();
  const color = String(payload.color || '').trim();
  const originalWeight = Number(payload.original_weight_grams);
  const remainingWeight = Number(payload.remaining_weight_grams);
  const minimumWeight = Number(payload.min_weight_grams ?? 0);

  if (!brand || !resolvedMaterialName || !color) {
    return 'Marka, materiał i kolor są wymagane.';
  }

  if (brand.length > 120 || resolvedMaterialName.length > 120 || color.length > 120) {
    return 'Marka, materiał i kolor mogą mieć maksymalnie po 120 znaków.';
  }

  if (payload.color_hex && !HEX_COLOR_REGEX.test(payload.color_hex)) {
    return 'Kolor musi mieć format HEX, na przykład #16A34A.';
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

  if (String(payload.location || '').trim().length > 160) {
    return 'Lokalizacja może mieć maksymalnie 160 znaków.';
  }

  if (String(payload.notes || '').trim().length > 2000) {
    return 'Notatki mogą mieć maksymalnie 2000 znaków.';
  }

  return null;
}

function optionalText(value: unknown) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function buildFilamentData(payload: FilamentPayload, resolvedMaterialName: string) {
  return {
    brand: String(payload.brand || '').trim(),
    material_id: payload.material_id || null,
    material_name: resolvedMaterialName,
    color: String(payload.color || '').trim(),
    color_hex: String(payload.color_hex || '#FFFFFF').toUpperCase(),
    image_url: optionalText(payload.image_url),
    price_per_kg: payload.price_per_kg ?? null,
    original_weight_grams: Number(payload.original_weight_grams),
    remaining_weight_grams: Number(payload.remaining_weight_grams),
    price_paid: payload.price_paid ?? null,
    min_weight_grams: Number(payload.min_weight_grams ?? 0),
    location: optionalText(payload.location),
    notes: optionalText(payload.notes),
    active: true,
    updated_at: new Date().toISOString(),
  };
}

function isFilamentsSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error ? String(error.message || '') : '';
  const code = 'code' in error ? String(error.code || '') : '';
  const isMissingColumn =
    code === 'PGRST204' ||
    code === '42703' ||
    message.includes('schema cache') ||
    (message.includes('column') && message.includes('does not exist'));

  return isMissingColumn && OPTIONAL_FILAMENT_COLUMNS.some((column) => message.includes(column));
}

function removeUnsupportedFilamentFields<T extends Record<string, unknown>>(data: T, error: unknown) {
  if (!error || typeof error !== 'object') return data;
  const message = 'message' in error ? String(error.message || '') : '';
  const nextData = { ...data };

  for (const column of OPTIONAL_FILAMENT_COLUMNS) {
    if (message.includes(column)) {
      delete nextData[column];
    }
  }

  return nextData;
}

function filamentErrorResponse(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code || '')
      : '';

  if (code === '23503') {
    return NextResponse.json(
      { error: 'Wybrany materiał nie istnieje.' },
      { status: 409 }
    );
  }

  if (['23514', '22003', '22P02'].includes(code)) {
    return NextResponse.json(
      { error: 'Jedna z wartości filamentu ma niepoprawny format.' },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Nie udało się zapisać zmian w magazynie filamentów.' },
    { status: 500 }
  );
}

async function saveFilament(
  client: SupabaseClient,
  payload: FilamentPayload,
  initialData: ReturnType<typeof buildFilamentData>
) {
  let data: Record<string, unknown> = initialData;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= OPTIONAL_FILAMENT_COLUMNS.length; attempt += 1) {
    const result = payload.id
      ? await client.from('filaments').update(data).eq('id', payload.id).select('id').maybeSingle()
      : await client.from('filaments').insert([data]).select('id').single();

    if (!result.error) {
      if (!result.data) {
        throw new Error('Filament nie istnieje lub nie masz dostępu do tego rekordu.');
      }
      return result.data;
    }

    lastError = result.error;
    if (!isFilamentsSchemaError(result.error)) throw result.error;

    const reducedData = removeUnsupportedFilamentFields(data, result.error);
    if (Object.keys(reducedData).length === Object.keys(data).length) {
      throw result.error;
    }
    data = reducedData;
  }

  throw lastError || new Error('Nie udało się zapisać filamentu.');
}

export async function POST(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const payload = (await readJsonObject(request, 64 * 1024)) as FilamentPayload;
    if (payload.id && !UUID_REGEX.test(payload.id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator filamentu.' }, { status: 400 });
    }
    if (payload.material_id && !UUID_REGEX.test(payload.material_id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator materiału.' }, { status: 400 });
    }

    const resolvedMaterialName = await resolveMaterialName(context.client, payload);
    const validationError = validatePayload(payload, resolvedMaterialName);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const data = buildFilamentData(payload, resolvedMaterialName);
    const savedFilament = await saveFilament(context.client, payload, data);

    return NextResponse.json({ success: true, id: savedFilament.id });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    console.error('Admin filament save error:', error);
    return filamentErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await getAdminSupabaseClient();
    if (context.error) return context.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator filamentu.' }, { status: 400 });
    }

    const deleteData = { active: false, updated_at: new Date().toISOString() };
    let { data, error } = await context.client
      .from('filaments')
      .update(deleteData)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error && isFilamentsSchemaError(error)) {
      const retry = await context.client
        .from('filaments')
        .update(removeUnsupportedFilamentFields(deleteData, error))
        .eq('id', id)
        .select('id')
        .maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Filament nie istnieje.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isSupabaseConfigurationError(error)) {
      return unavailableResponse();
    }

    console.error('Admin filament delete error:', error);
    return NextResponse.json(
      { error: 'Nie udało się usunąć filamentu.' },
      { status: 500 }
    );
  }
}
