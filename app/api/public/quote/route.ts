import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigurationError } from '@/lib/supabase/env';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['standard', 'express', 'urgent']);
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

    const body = await readJsonObject(request, 64 * 1024);
    const action = cleanString(body.action);
    const orderId = cleanString(body.order_id);

    if (action === 'create') {
      const materialId = cleanString(body.material_id);
      const materialName = cleanString(body.material_name) || 'Do ustalenia';
      const color = cleanString(body.color) || 'Do ustalenia';
      const colorHex = cleanString(body.color_hex) || null;
      const quantity = Number(body.quantity);
      const priority = cleanString(body.priority);
      const notes = cleanString(body.notes) || null;

      if (
        !UUID_PATTERN.test(orderId) ||
        !UUID_PATTERN.test(materialId) ||
        materialName.length > 120 ||
        color.length > 120 ||
        (colorHex !== null && !COLOR_HEX_PATTERN.test(colorHex)) ||
        (notes !== null && notes.length > 2000) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 1000 ||
        !PRIORITIES.has(priority)
      ) {
        return NextResponse.json({ error: 'Niepoprawne dane wyceny.' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('orders_3d')
        .insert([
          {
            id: orderId,
            user_id: auth.user.id,
            material_id: materialId,
            material_name: materialName,
            color,
            color_hex: colorHex,
            layer_height: 0.2,
            quantity,
            priority,
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
