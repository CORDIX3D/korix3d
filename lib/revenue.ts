export const RECOGNIZED_ORDER_3D_STATUSES = [
  'accepted',
  'queued',
  'printing',
  'post_processing',
  'packed',
  'shipped',
  'completed',
] as const;

export const RECOGNIZED_STORE_ORDER_STATUSES = [
  'paid',
  'processing',
  'shipped',
  'delivered',
] as const;

const recognizedOrder3DStatuses = new Set<string>(RECOGNIZED_ORDER_3D_STATUSES);
const recognizedStoreOrderStatuses = new Set<string>(RECOGNIZED_STORE_ORDER_STATUSES);

export function isRecognizedOrder3DRevenue(status: unknown) {
  return recognizedOrder3DStatuses.has(String(status || ''));
}

export function isRecognizedStoreOrderRevenue(status: unknown) {
  return recognizedStoreOrderStatuses.has(String(status || ''));
}
