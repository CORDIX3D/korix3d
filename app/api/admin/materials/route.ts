import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function optionalNumber(value: FormDataEntryValue | null) {
  if (!value || !String(value).trim()) return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function requiredPositiveNumber(value: FormDataEntryValue | null) {
  const number = optionalNumber(value);
  return number && number > 0 ? number : null;
}

function normalizeHex(value: string) {
  const hex = value.trim();
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff';
}

function validateTemperatureRange(min: number | null, max: number | null, label: string) {
  if (min !== null && max !== null && min > max) {
    return `${label}: temperatura minimalna nie może być większa od maksymalnej.`;
  }

  return null;
}

function slugify(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createClient();
    const { data: auth } = await sessionClient.auth.getUser();
    if (!auth.user) return NextResponse.json({ error: 'Zaloguj się ponownie.' }, { status: 401 });

    const { data: profile } = await sessionClient.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 403 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return NextResponse.json({ error: 'Brak konfiguracji Supabase na serwerze.' }, { status: 503 });
    const admin = createSupabaseClient(url, serviceKey);
    const form = await request.formData();
    const id = String(form.get('id') || '').trim();
    const name = String(form.get('name') || '').trim();
    const colorName = String(form.get('color_name') || '').trim();
    const colorHex = normalizeHex(String(form.get('color_hex') || '#ffffff'));
    const price = requiredPositiveNumber(form.get('price_per_kg'));
    if (!name || !colorName || !price) {
      return NextResponse.json({ error: 'Uzupełnij rodzaj materiału, kolor i prawidłową cenę.' }, { status: 400 });
    }

    const printTempMin = optionalNumber(form.get('print_temp_min'));
    const printTempMax = optionalNumber(form.get('print_temp_max'));
    const bedTempMin = optionalNumber(form.get('bed_temp_min'));
    const bedTempMax = optionalNumber(form.get('bed_temp_max'));
    const temperatureError =
      validateTemperatureRange(printTempMin, printTempMax, 'Dysza') ||
      validateTemperatureRange(bedTempMin, bedTempMax, 'Stół');
    if (temperatureError) {
      return NextResponse.json({ error: temperatureError }, { status: 400 });
    }

    let imageUrl = String(form.get('existing_image_url') || '').trim() || null;
    const removeImage = form.get('remove_image') === 'true';
    const image = form.get('image');
    if (removeImage) imageUrl = null;
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/') || image.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Zdjęcie musi być obrazem o rozmiarze do 5 MB.' }, { status: 400 });
      }
      const extension = image.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `materials/${crypto.randomUUID()}.${extension}`;
      const bytes = new Uint8Array(await image.arrayBuffer());
      const { error: uploadError } = await admin.storage.from('product-images').upload(path, bytes, { contentType: image.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      imageUrl = admin.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    }

    let materialId = id;
    let existingSlug = '';
    if (!materialId) {
      const { data: existing } = await admin.from('materials').select('id, slug').ilike('name', name).limit(1).maybeSingle();
      materialId = existing?.id || '';
      existingSlug = existing?.slug || '';
    } else {
      const { data: existing } = await admin.from('materials').select('slug').eq('id', materialId).maybeSingle();
      existingSlug = existing?.slug || '';
    }

    const materialData = {
      name,
      slug: existingSlug || `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      description: String(form.get('description') || '').trim() || null,
      price_per_kg: price,
      image_url: imageUrl,
      print_temp_min: printTempMin,
      print_temp_max: printTempMax,
      bed_temp_min: bedTempMin,
      bed_temp_max: bedTempMax,
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

    const { data: existingColor } = await admin.from('material_colors').select('id').eq('material_id', materialId).ilike('name', colorName).limit(1).maybeSingle();
    const colorData = { material_id: materialId, name: colorName, hex: colorHex, available: true };
    const colorResult = existingColor
      ? await admin.from('material_colors').update(colorData).eq('id', existingColor.id)
      : await admin.from('material_colors').insert(colorData);
    if (colorResult.error) throw colorResult.error;

    return NextResponse.json({ success: true, materialId });
  } catch (error) {
    console.error('Admin material save error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Nie udało się zapisać materiału.' }, { status: 500 });
  }
}
