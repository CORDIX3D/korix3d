export const STORE_ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type StoreOrderStatus = (typeof STORE_ORDER_STATUSES)[number];

export const STORE_ORDER_ALLOWED_TRANSITIONS: Record<
  StoreOrderStatus,
  readonly StoreOrderStatus[]
> = {
  pending: ['pending'],
  paid: ['paid', 'processing'],
  processing: ['processing', 'shipped'],
  shipped: ['shipped', 'delivered'],
  delivered: ['delivered'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
};

const DATABASE_TRANSITIONS: Record<StoreOrderStatus, readonly StoreOrderStatus[]> = {
  pending: ['pending', 'paid', 'cancelled'],
  paid: ['paid', 'processing', 'refunded'],
  processing: ['processing', 'shipped', 'refunded'],
  shipped: ['shipped', 'delivered', 'refunded'],
  delivered: ['delivered', 'refunded'],
  cancelled: ['cancelled'],
  refunded: ['refunded'],
};

export function isStoreOrderStatus(value: unknown): value is StoreOrderStatus {
  return STORE_ORDER_STATUSES.includes(value as StoreOrderStatus);
}

export function canManageStoreOrderStatus(
  current: unknown,
  next: unknown
) {
  return isStoreOrderStatus(current)
    && isStoreOrderStatus(next)
    && STORE_ORDER_ALLOWED_TRANSITIONS[current].includes(next);
}

export function canTransitionStoreOrderStatus(
  current: unknown,
  next: unknown
) {
  return isStoreOrderStatus(current)
    && isStoreOrderStatus(next)
    && DATABASE_TRANSITIONS[current].includes(next);
}
