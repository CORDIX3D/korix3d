export type DiscountCodeRecord = {
  code: string;
  discount_type: string;
  discount_value: number | string;
  min_order_value?: number | string | null;
  max_uses?: number | string | null;
  used_count?: number | string | null;
  active?: boolean | null;
  expires_at?: string | null;
};

export type DiscountResult =
  | { valid: true; code: string; amount: number; subtotalAfterDiscount: number }
  | { valid: false; reason: 'invalid' | 'expired' | 'limit' | 'minimum' };

export function normalizeCouponCode(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDiscount(
  coupon: DiscountCodeRecord | null | undefined,
  subtotalValue: number,
  now = new Date()
): DiscountResult {
  const subtotal = money(Number(subtotalValue));
  if (!coupon || coupon.active !== true || !Number.isFinite(subtotal) || subtotal <= 0) {
    return { valid: false, reason: 'invalid' };
  }

  const code = normalizeCouponCode(coupon.code);
  const value = Number(coupon.discount_value);
  const minimum = Number(coupon.min_order_value || 0);
  const maxUses = coupon.max_uses == null ? null : Number(coupon.max_uses);
  const usedCount = Number(coupon.used_count || 0);

  if (
    !/^[A-Z0-9_-]{2,40}$/.test(code) ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(minimum) ||
    minimum < 0 ||
    !Number.isFinite(usedCount) ||
    usedCount < 0
  ) {
    return { valid: false, reason: 'invalid' };
  }

  if (coupon.expires_at) {
    const expiresAt = new Date(coupon.expires_at);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      return { valid: false, reason: 'expired' };
    }
  }

  if (maxUses !== null) {
    if (!Number.isInteger(maxUses) || maxUses < 1 || usedCount >= maxUses) {
      return { valid: false, reason: 'limit' };
    }
  }

  if (subtotal < minimum) return { valid: false, reason: 'minimum' };

  let amount: number;
  if (coupon.discount_type === 'percent') {
    if (value > 100) return { valid: false, reason: 'invalid' };
    amount = money(subtotal * value / 100);
  } else if (coupon.discount_type === 'fixed') {
    amount = money(Math.min(value, subtotal));
  } else {
    return { valid: false, reason: 'invalid' };
  }

  return {
    valid: true,
    code,
    amount,
    subtotalAfterDiscount: money(Math.max(0, subtotal - amount)),
  };
}
