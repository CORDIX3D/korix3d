import { NextRequest, NextResponse } from 'next/server';
import {
  adminApiUnavailableResponse,
  requireAdminApiContext,
} from '@/lib/api/admin-context';
import { isJsonBodyError, readJsonObject } from '@/lib/api/json-body';

export const dynamic = 'force-dynamic';

const AI_SETTING_LIMITS: Record<string, number> = {
  enabled: 5,
  greeting: 500,
  system_prompt: 5000,
};

const SECRET_VALUE_PATTERN = /(?:\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}\b|\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b|\bsbp_[A-Za-z0-9]{16,}\b|\bwhsec_[A-Za-z0-9]{16,}\b|OPENAI_API_KEY\s*=)/i;

function normalizeSettings(settings: unknown) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const entries = Object.entries(settings as Record<string, unknown>);
  if (entries.length < 1 || entries.length > Object.keys(AI_SETTING_LIMITS).length) return null;

  const normalized = entries.map(([rawKey, rawValue]) => {
    const key = rawKey.trim();
    const value = String(rawValue ?? '').trim();
    return { key, value };
  });

  if (normalized.some(({ key, value }) => (
    !Object.prototype.hasOwnProperty.call(AI_SETTING_LIMITS, key)
    || value.length > AI_SETTING_LIMITS[key]
    || SECRET_VALUE_PATTERN.test(value)
    || (key === 'enabled' && !['true', 'false'].includes(value))
  ))) {
    return null;
  }

  return normalized;
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await requireAdminApiContext();
    if (result.response) return result.response;

    const body = await readJsonObject(request, 8 * 1024);
    const settings = normalizeSettings(body.settings);

    if (!settings) {
      return NextResponse.json({ error: 'Niepoprawne dane ustawień AI.' }, { status: 400 });
    }

    const settingKeys = settings.map((setting) => setting.key);
    const { data: existingSettings, error: lookupError } = await result.context.adminClient
      .from('ai_settings')
      .select('setting_key')
      .in('setting_key', settingKeys);

    if (lookupError) throw lookupError;
    const existingKeys = new Set((existingSettings || []).map((setting) => setting.setting_key));
    const missingKey = settingKeys.find((key) => !existingKeys.has(key));
    if (missingKey) {
      return NextResponse.json(
        { error: `Brak ustawienia „${missingKey}” w bazie.` },
        { status: 409 }
      );
    }

    for (const setting of settings) {
      const { error } = await result.context.adminClient
        .from('ai_settings')
        .update({ setting_value: setting.value, updated_at: new Date().toISOString() })
        .eq('setting_key', setting.key);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isJsonBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Admin AI settings update error:', error);
    return adminApiUnavailableResponse();
  }
}
