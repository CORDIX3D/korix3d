export const QUOTE_PRICING_KEYS = [
  'printing_hour_cost',
  'electricity_hour_cost',
  'maintenance_hour_cost',
  'packaging_cost',
  'default_margin',
  'vat_rate',
  'minimum_order_value',
  'express_surcharge',
  'urgent_surcharge',
] as const;

export type QuotePricingKey = (typeof QUOTE_PRICING_KEYS)[number];

export type QuotePricingSettings = Record<QuotePricingKey, number>;

export type QuotePricingSettingRow = {
  key: string | null;
  value: string | number | null;
};

const MAX_VALUES: Record<QuotePricingKey, number> = {
  printing_hour_cost: 10_000,
  electricity_hour_cost: 10_000,
  maintenance_hour_cost: 10_000,
  packaging_cost: 10_000,
  default_margin: 1_000,
  vat_rate: 100,
  minimum_order_value: 1_000_000,
  express_surcharge: 100_000,
  urgent_surcharge: 100_000,
};

export function parseQuotePricingSettings(
  rows: QuotePricingSettingRow[]
): QuotePricingSettings | null {
  const parsed = new Map<QuotePricingKey, number>();

  for (const row of rows) {
    if (!QUOTE_PRICING_KEYS.includes(row.key as QuotePricingKey)) continue;
    const key = row.key as QuotePricingKey;
    const rawValue = String(row.value ?? '').trim();
    const value = Number(rawValue.replace(',', '.'));
    if (
      !rawValue
      || !Number.isFinite(value)
      || value < 0
      || value > MAX_VALUES[key]
    ) {
      return null;
    }
    parsed.set(key, Math.round((value + Number.EPSILON) * 100) / 100);
  }

  if (parsed.size !== QUOTE_PRICING_KEYS.length) return null;
  return Object.fromEntries(parsed) as QuotePricingSettings;
}
