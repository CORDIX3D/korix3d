export const ORDER_3D_STATUSES = [
  'new',
  'quoted',
  'accepted',
  'queued',
  'printing',
  'post_processing',
  'packed',
  'shipped',
  'completed',
  'cancelled',
] as const;

export type Order3DStatus = (typeof ORDER_3D_STATUSES)[number];

export const ORDER_3D_STATUS_LABELS: Record<Order3DStatus, string> = {
  new: 'Nowe',
  quoted: 'Wyceniono',
  accepted: 'Zaakceptowane',
  queued: 'W kolejce',
  printing: 'Drukowanie',
  post_processing: 'Post-processing',
  packed: 'Spakowane',
  shipped: 'Wysłane',
  completed: 'Zrealizowane',
  cancelled: 'Anulowane',
};

const ORDER_3D_TRANSITIONS: Record<Order3DStatus, ReadonlySet<Order3DStatus>> = {
  new: new Set(['new', 'quoted', 'cancelled']),
  quoted: new Set(['quoted', 'accepted', 'cancelled']),
  accepted: new Set(['accepted', 'quoted', 'queued', 'printing', 'cancelled']),
  queued: new Set(['queued', 'accepted', 'quoted', 'printing', 'cancelled']),
  printing: new Set(['printing', 'post_processing', 'packed', 'completed', 'cancelled']),
  post_processing: new Set(['post_processing', 'printing', 'packed', 'completed', 'cancelled']),
  packed: new Set(['packed', 'post_processing', 'shipped', 'completed', 'cancelled']),
  shipped: new Set(['shipped', 'completed']),
  completed: new Set(['completed']),
  cancelled: new Set(['cancelled']),
};

export function isOrder3DStatus(value: string): value is Order3DStatus {
  return (ORDER_3D_STATUSES as readonly string[]).includes(value);
}

export function canTransitionOrder3DStatus(current: string, next: string) {
  return isOrder3DStatus(current)
    && isOrder3DStatus(next)
    && ORDER_3D_TRANSITIONS[current].has(next);
}

export function getAllowedOrder3DStatuses(current: string): Order3DStatus[] {
  if (!isOrder3DStatus(current)) return [];
  return Array.from(ORDER_3D_TRANSITIONS[current]);
}
