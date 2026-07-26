export type DeliveryOption = {
  value: string;
  label: string;
  price: number;
};

export type ShippingSetting = {
  key: string | null;
  label: string | null;
  value: string | number | null;
};

export const IGNORED_SHIPPING_SETTING_KEYS = new Set(['free_shipping_threshold']);

export function parseDeliveryOptions(settings: ShippingSetting[]): DeliveryOption[] {
  const seenValues = new Set<string>();

  return settings.flatMap((setting) => {
    const key = String(setting.key || '').trim().toLowerCase();
    if (
      !key
      || IGNORED_SHIPPING_SETTING_KEYS.has(key)
      || !/^[a-z0-9_-]{1,80}$/.test(key)
    ) {
      return [];
    }

    const value = key.replace(/_price$/, '');
    const rawPrice = String(setting.value ?? '').trim();
    const price = Number(rawPrice.replace(',', '.'));
    if (
      !value
      || seenValues.has(value)
      || !rawPrice
      || !Number.isFinite(price)
      || price < 0
      || price > 10_000
    ) {
      return [];
    }

    seenValues.add(value);
    return [{
      value,
      label: String(setting.label || '').trim() || value.replace(/_/g, ' '),
      price: Math.round((price + Number.EPSILON) * 100) / 100,
    }];
  });
}
