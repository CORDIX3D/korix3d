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
  parseDeliveryOptions,
} from '@/lib/shipping';
import {
  createQuotePricingSnapshot,
  parseQuotePricingSettings,
} from '@/lib/quote-pricing';
import { validateQuoteFiles } from '@/lib/quote-files';
import type { StoredQuoteFile } from '@/lib/quote-files';
import { validateQuoteFileSignature } from '@/lib/quote-file-content';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['standard', 'express', 'urgent']);
const INFILL_VALUES = new Set([10, 20, 30, 50, 80, 100]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COLOR_HEX_PATTERN = /^#[0-9a-f]{6}$/i;

function cleanString(value: unknown) {
  return String(value || '').trim();
}

async function readFileRange(url: string, range: string, requirePartial = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { Range: range },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok || (requirePartial && response.status !== 206) || !response.body) {
      throw new Error('Stored file range is unavailable');
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < 131_072) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = 131_072 - total;
      const chunk = value.length > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.length;
      if (value.length > remaining) break;
    }
    await reader.cancel();

    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyStoredQuoteFiles(
  admin: ReturnType<typeof createServiceRoleClient>,
  files: StoredQuoteFile[]
) {
  for (const file of files) {
    const bucket = String(file.bucket || '');
    const storagePath = String(file.storage_path || '');
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60);
    if (error || !data?.signedUrl) throw error || new Error('Signed file URL missing');

    const head = await readFileRange(data.signedUrl, 'bytes=0-131071');
    const tail = file.type === '3mf'
      ? await readFileRange(data.signedUrl, 'bytes=-131072', true)
      : head;
    const validationError = validateQuoteFileSignature(file, head, tail);
    if (validationError) return validationError;
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
        { data: quoteSettings, error: settingsError },
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
            .select('key, label, value, category')
            .in('category', ['shipping', 'pricing']),
        ]);

      if (materialError || filamentError || settingsError) {
        console.error('Quote configuration lookup error:', materialError || filamentError || settingsError);
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

      const deliverySetting = parseDeliveryOptions(
        (quoteSettings || []).filter((setting) => setting.category === 'shipping')
      )
        .find((option) => option.value === deliveryType);

      if (!deliverySetting) {
        return NextResponse.json(
          { error: 'Wybrana metoda dostawy nie jest już dostępna.' },
          { status: 409 }
        );
      }

      const pricingSettings = parseQuotePricingSettings(
        (quoteSettings || []).filter((setting) => setting.category === 'pricing')
      );
      if (!pricingSettings) {
        return NextResponse.json(
          { error: 'Cennik automatycznej wyceny jest niekompletny. Skontaktuj się z nami.' },
          { status: 503, headers: { 'Retry-After': '60' } }
        );
      }

      const deliveryCost = deliverySetting.price;
      const pricingSnapshot = createQuotePricingSnapshot(pricingSettings, {
        materialPricePerKg: Number(filament.price_per_kg || 0) > 0
          ? Number(filament.price_per_kg)
          : Number(material.price_per_kg || 0),
        deliveryCost,
        priority,
      });

      if (!pricingSnapshot) {
        return NextResponse.json(
          { error: 'Nie udało się zabezpieczyć warunków wyceny. Spróbuj ponownie później.' },
          { status: 503, headers: { 'Retry-After': '60' } }
        );
      }

      const canonicalColor = `${filament.color}${filament.brand ? ` (${filament.brand})` : ''}`;
      const canonicalColorHex =
        cleanString(filament.color_hex) && COLOR_HEX_PATTERN.test(cleanString(filament.color_hex))
          ? cleanString(filament.color_hex)
          : null;

      const orderPayload = {
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
      };

      const insertResult = await admin
        .from('orders_3d')
        .insert([
          {
            ...orderPayload,
            pricing_settings_snapshot: pricingSnapshot,
          },
        ])
        .select('order_number')
        .single();

      const { data, error } = insertResult;

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

      const validationError = validateQuoteFiles(body.files, auth.user.id, orderId);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      let contentValidationError: string | null;
      try {
        contentValidationError = await verifyStoredQuoteFiles(
          admin,
          body.files as StoredQuoteFile[]
        );
      } catch (verificationError) {
        console.error('Quote file verification error:', verificationError);
        return NextResponse.json(
          { error: 'Nie udało się bezpiecznie sprawdzić przesłanych plików. Spróbuj ponownie.' },
          { status: 503, headers: { 'Retry-After': '30' } }
        );
      }
      if (contentValidationError) {
        return NextResponse.json({ error: contentValidationError }, { status: 400 });
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
