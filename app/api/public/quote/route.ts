import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getRequiredSupabaseServiceEnv,
  isSupabaseConfigurationError,
} from '@/lib/supabase/env';
import { createServiceRoleClient } from '@/lib/supabase/service-client';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/api/public-rate-limit';
import {
  DEFAULT_DELIVERY_OPTIONS,
  IGNORED_SHIPPING_SETTING_KEYS,
} from '@/lib/shipping';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['standard', 'express', 'urgent']);
const INFILL_VALUES = new Set([10, 20, 30, 50, 80, 100]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/i;

type StoredQuoteFile = {
  name?: string;
  size?: number;
  type?: string;
  bucket?: string;
  storage_path?: string;
};

function cleanString(value: unknown) {
  return String(value || '').trim();
}

function validateFiles(files: unknown, userId: string, orderId: string) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 10) {
    return 'Niepoprawna liczba plików.';
  }

  const prefix = `${userId}/${orderId}/`;
  let totalSize = 0;
  const uniquePaths = new Set<string>();

  for (const file of files as StoredQuoteFile[]) {
    const size = Number(file.size);
    const type = cleanString(file.type).toLowerCase();
    const path = cleanString(file.storage_path);
    const name = cleanString(file.name);

    if (
      cleanString(file.bucket) !== 'quote-files' ||
      !path.startsWith(prefix) ||
      path.length > 1024 ||
      !name ||
      name.length > 255 ||
      !['stl', 'step', 'stp', 'obj', '3mf'].includes(type) ||
      !Number.isFinite(size) ||
      size < 1 ||
      size > 50 * 1024 * 1024 ||
      uniquePaths.has(path)
    ) {
      return 'Niepoprawne metadane pliku.';
    }

    uniquePaths.add(path);
    totalSize += size;
  }

  if (totalSize > 200 * 1024 * 1024) {
    return 'Przekroczono łączny limit plików.';
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      return NextResponse.json({ error: 'Zaloguj się, aby wysłać wycenę.' }, { status: 401 });
    }

    const { url, serviceRoleKey } = getRequiredSupabaseServiceEnv();
    const admin = createServiceRoleClient(url, serviceRoleKey, auth.user.id);

    const body = await readJsonObject(request, 64 * 1024);
    const action = cleanString(body.action);
    const orderId = cleanString(body.order_id);

    if (action === 'create') {
      const rateLimit = await checkPublicRateLimit(request, {
        scope: 'quote_create',
        limit: 5,
        windowSeconds: 60 * 60,
        userId: auth.user.id,
        consumePersistent: async (args) => {
          const { data, error } = await admin.rpc('consume_public_api_rate_limit', args);
          return { data: data === true, error };
        },
      });

      if (!rateLimit.allowed) {
        return rateLimitResponse(
          'Osiągnięto limit nowych wycen. Spróbuj ponownie później.',
          rateLimit.retryAfter
        );
      }

      const { count: activeQuoteCount, error: activeQuoteError } = await admin
        .from('orders_3d')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', auth.user.id)
        .eq('status', 'new');

      if (activeQuoteError) {
        console.error('Active quote count error:', activeQuoteError);
        return NextResponse.json(
          { error: 'Nie udało się sprawdzić aktywnych wycen.' },
          { status: 500 }
        );
      }

      if ((activeQuoteCount || 0) >= 5) {
        return NextResponse.json(
          {
            error: 'Masz już 5 wycen oczekujących na analizę. Poczekaj na ich zakończenie przed dodaniem kolejnej.',
          },
          { status: 409 }
        );
      }

      const materialId = cleanString(body.material_id);
      const filamentId = cleanString(body.filament_id);
      const infillPercent = Number(body.infill_percent);
      const quantity = Number(body.quantity);
      const priority = cleanString(body.priority);
      const deliveryType = cleanString(body.delivery_type);
      const notes = cleanString(body.notes) || null;

      if (
        !UUID_PATTERN.test(orderId) ||
        !UUID_PATTERN.test(materialId) ||
        !UUID_PATTERN.test(filamentId) ||
        !INFILL_VALUES.has(infillPercent) ||
        (notes !== null && notes.length > 2000) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 1000 ||
        !PRIORITIES.has(priority) ||
        !/^[a-z0-9_-]{1,80}$/.test(deliveryType)
      ) {
        return NextResponse.json({ error: 'Niepoprawne dane wyceny.' }, { status: 400 });
      }

      const [
        { data: material, error: materialError },
        { data: filament, error: filamentError },
        { data: shippingSettings, error: shippingError },
      ] =
        await Promise.all([
          admin
            .from('materials')
            .select('id, name, price_per_kg')
            .eq('id', materialId)
            .eq('available', true)
            .maybeSingle(),
          admin
            .from('filaments')
            .select('id, material_id, brand, color, color_hex, active, remaining_weight_grams, price_per_kg')
            .eq('id', filamentId)
            .maybeSingle(),
          admin
            .from('settings')
            .select('key, label, value')
            .eq('category', 'shipping'),
        ]);

      if (materialError || filamentError || shippingError) {
        console.error('Quote configuration lookup error:', materialError || filamentError || shippingError);
        return NextResponse.json(
          { error: 'Nie udało się sprawdzić wybranych parametrów wyceny.' },
          { status: 500 }
        );
      }

      if (
        !material ||
        !filament ||
        filament.material_id !== material.id ||
        filament.active !== true ||
        Number(filament.remaining_weight_grams || 0) <= 0 ||
        Math.max(Number(filament.price_per_kg || 0), Number(material.price_per_kg || 0)) <= 0
      ) {
        return NextResponse.json(
          { error: 'Wybrany filament jest niedostępny albo nie ma ustawionej ceny za kilogram.' },
          { status: 409 }
        );
      }

      const availableShippingSettings = (shippingSettings || []).filter(
        (setting) => setting.key && !IGNORED_SHIPPING_SETTING_KEYS.has(setting.key)
      );
      const deliverySetting = availableShippingSettings.find((setting) =>
        setting.key === deliveryType || setting.key.replace(/_price$/, '') === deliveryType
      );
      const defaultDelivery = availableShippingSettings.length === 0
        ? DEFAULT_DELIVERY_OPTIONS.find((option) => option.value === deliveryType)
        : undefined;

      if (!deliverySetting && !defaultDelivery) {
        return NextResponse.json(
          { error: 'Wybrana metoda dostawy nie jest już dostępna.' },
          { status: 409 }
        );
      }

      const deliveryCost = deliverySetting
        ? Number(String(deliverySetting.value ?? '0').replace(',', '.'))
        : Number(defaultDelivery?.price ?? 0);

      if (!Number.isFinite(deliveryCost) || deliveryCost < 0 || deliveryCost > 10_000) {
        return NextResponse.json(
          { error: 'Koszt wybranej dostawy jest nieprawidłowy.' },
          { status: 500 }
        );
      }

      const canonicalColor = `${filament.color}${filament.brand ? ` (${filament.brand})` : ''}`;
      const canonicalColorHex =
        cleanString(filament.color_hex) && COLOR_HEX_PATTERN.test(cleanString(filament.color_hex))
          ? cleanString(filament.color_hex)
          : null;

      const { data, error } = await admin
        .from('orders_3d')
        .insert([
          {
            id: orderId,
            user_id: auth.user.id,
            material_id: materialId,
            filament_id: filamentId,
            material_name: material.name,
            color: canonicalColor,
            color_hex: canonicalColorHex,
            infill_percent: infillPercent,
            layer_height: 0.2,
            quantity,
            priority,
            delivery_type: deliveryType,
            delivery_cost: deliveryCost,
            notes,
            status: 'new',
            files: [],
          },
        ])
        .select('order_number')
        .single();

      if (error) {
        console.error('Quote create error:', error);
        return NextResponse.json(
          { error: 'Nie udało się utworzyć zlecenia wyceny.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, order_number: data?.order_number || null });
    }

    if (action === 'finalize') {
      if (!UUID_PATTERN.test(orderId)) {
        return NextResponse.json({ error: 'Brak identyfikatora zlecenia.' }, { status: 400 });
      }

      const validationError = validateFiles(body.files, auth.user.id, orderId);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const { data, error } = await supabase.rpc('finalize_quote_files', {
        p_order_id: orderId,
        p_files: body.files,
      });

      if (error || !data) {
        console.error('Quote finalize error:', error);
        return NextResponse.json(
          { error: 'Nie udało się przypisać plików do zlecenia.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'discard') {
      if (!UUID_PATTERN.test(orderId)) {
        return NextResponse.json({ error: 'Brak identyfikatora zlecenia.' }, { status: 400 });
      }

      const { error } = await supabase.rpc('discard_incomplete_quote', {
        p_order_id: orderId,
      });
      if (error) {
        console.error('Quote discard error:', error);
        return NextResponse.json(
          { error: 'Nie udało się usunąć niedokończonego zlecenia.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Niepoprawna akcja wyceny.' }, { status: 400 });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (isSupabaseConfigurationError(error)) {
      return NextResponse.json(
        { error: 'Formularz wyceny jest chwilowo niedostępny.' },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '60',
          },
        }
      );
    }

    console.error('Quote submit error:', error);
    return NextResponse.json(
      { error: 'Nie udało się obsłużyć wyceny.' },
      { status: 500 }
    );
  }
}
