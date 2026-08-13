export const QUOTE_PRICING_KEYS = [
  'printing_hour_cost',
  'electricity_hour_cost',
  'maintenance_hour_cost',
  'packaging_cost',
  'default_margin',
  'vat_rate',
  'minimum_order_value',
  'express_surcharge_percent',
  'urgent_surcharge_percent',
] as const;

export type QuotePricingKey = (typeof QUOTE_PRICING_KEYS)[number];

export type QuotePricingSettings = Record<QuotePricingKey, number>;

export type QuotePriority = 'standard' | 'express' | 'urgent';

export type QuotePricingSnapshot = QuotePricingSettings & {
  material_price_per_kg: number;
  delivery_cost: number;
  priority: QuotePriority;
  captured_at: string;
};

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
  express_surcharge_percent: 500,
  urgent_surcharge_percent: 500,
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

export function createQuotePricingSnapshot(
  settings: QuotePricingSettings,
  input: {
    materialPricePerKg: number;
    deliveryCost: number;
    priority: string;
    capturedAt?: string;
  }
): QuotePricingSnapshot | null {
  const materialPricePerKg = Number(input.materialPricePerKg);
  const deliveryCost = Number(input.deliveryCost);
  const capturedAt = input.capturedAt || new Date().toISOString();

  if (
    !Number.isFinite(materialPricePerKg)
    || materialPricePerKg <= 0
    || materialPricePerKg > 1_000_000
    || !Number.isFinite(deliveryCost)
    || deliveryCost < 0
    || deliveryCost > 10_000
    || !['standard', 'express', 'urgent'].includes(input.priority)
    || !Number.isFinite(Date.parse(capturedAt))
  ) {
    return null;
  }

  return {
    ...settings,
    material_price_per_kg: Math.round((materialPricePerKg + Number.EPSILON) * 100) / 100,
    delivery_cost: Math.round((deliveryCost + Number.EPSILON) * 100) / 100,
    priority: input.priority as QuotePriority,
    captured_at: capturedAt,
  };
}
