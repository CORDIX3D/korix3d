import type { createServiceRoleClient } from '@/lib/supabase/service-client';

type ProductionClient = ReturnType<typeof createServiceRoleClient>;

const MISSING_HEARTBEAT_TABLE_CODES = new Set(['42P01', 'PGRST205']);
const WORKER_ONLINE_WINDOW_MS = 90_000;
const PAID_STORE_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered']);

function finiteNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentState(status: string) {
  if (status === 'refunded') return 'refunded';
  if (PAID_STORE_STATUSES.has(status)) return 'paid';
  return 'unpaid';
}

export async function getProductionOverview(client: ProductionClient) {
  const [quotesResult, storeOrdersResult, jobsResult, workersResult] = await Promise.all([
    client
      .from('orders_3d')
      .select(
        'id, order_number, status, material_name, color, infill_percent, quantity, priority, slicing_status, printing_time_hours, filament_used_grams, vat_amount, final_price, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('store_orders')
      .select(
        'id, order_number, status, customer_name, subtotal, shipping_cost, vat_amount, total, tracking_number, created_at, updated_at'
      )
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('slicing_jobs')
      .select(
        'id, order_id, file_index, input_file, material_name, color, infill_percent, status, attempt_count, worker_id, slicer_name, slicer_version, result, error_message, requested_at, started_at, completed_at, orders_3d(order_number)'
      )
      .order('requested_at', { ascending: false })
      .limit(50),
    client
      .from('slicer_workers')
      .select('id, slicer_name, slicer_version, printer_profile, process_profile, last_seen_at')
      .order('last_seen_at', { ascending: false })
      .limit(10),
  ]);

  if (quotesResult.error) throw quotesResult.error;
  if (storeOrdersResult.error) throw storeOrdersResult.error;
  if (jobsResult.error) throw jobsResult.error;
  if (
    workersResult.error
    && !MISSING_HEARTBEAT_TABLE_CODES.has(String(workersResult.error.code || ''))
  ) {
    throw workersResult.error;
  }

  const now = Date.now();
  const quotes = (quotesResult.data || []).map((order) => {
    const gross = finiteNumber(order.final_price);
    const vat = finiteNumber(order.vat_amount);
    return {
      ...order,
      final_price: gross,
      net_price: Math.max(0, Math.round((gross - vat) * 100) / 100),
      vat_amount: vat,
    };
  });
  const storeOrders = (storeOrdersResult.data || []).map((order) => ({
    ...order,
    subtotal: finiteNumber(order.subtotal),
    shipping_cost: finiteNumber(order.shipping_cost),
    vat_amount: finiteNumber(order.vat_amount),
    total: finiteNumber(order.total),
    net_total: Math.max(
      0,
      Math.round((finiteNumber(order.total) - finiteNumber(order.vat_amount)) * 100) / 100
    ),
    payment_state: paymentState(order.status),
  }));
  const workers = workersResult.error ? [] : workersResult.data || [];
  const activeWorkers = workers.filter((worker) => {
    const lastSeen = new Date(worker.last_seen_at).getTime();
    return Number.isFinite(lastSeen) && now - lastSeen <= WORKER_ONLINE_WINDOW_MS;
  });
  const jobs = jobsResult.data || [];
  const jobCounts = jobs.reduce<Record<string, number>>((counts, job) => {
    counts[job.status] = (counts[job.status] || 0) + 1;
    return counts;
  }, {});
  const paidStoreOrders = storeOrders.filter((order) => order.payment_state === 'paid');
  const openProductionOrders = quotes.filter((order) =>
    ['accepted', 'queued', 'printing', 'post_processing', 'packed'].includes(order.status)
  );

  return {
    worker: {
      heartbeat_available: !workersResult.error,
      online: activeWorkers.length > 0,
      active_count: activeWorkers.length,
      latest: workers[0] || null,
    },
    summary: {
      pending_calculations: jobCounts.pending || 0,
      processing_calculations: jobCounts.processing || 0,
      failed_calculations: jobCounts.failed || 0,
      open_production_orders: openProductionOrders.length,
      unpaid_store_orders: storeOrders.filter((order) => order.payment_state === 'unpaid').length,
      paid_store_orders: paidStoreOrders.length,
      paid_store_value: Math.round(
        paidStoreOrders.reduce((sum, order) => sum + order.total, 0) * 100
      ) / 100,
    },
    calculations: jobs,
    quote_orders: quotes,
    store_orders: storeOrders,
    checked_at: new Date(now).toISOString(),
  };
}
