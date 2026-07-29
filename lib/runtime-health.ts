import { inspectServerEnvironment } from '@/lib/env/server';

export function getRuntimeHealth() {
  const environment = inspectServerEnvironment();
  const services = {
    supabase: environment.supabase.configured,
    stripe: environment.stripe.configured,
    slicer: environment.slicer.configured,
    monitoring: environment.monitoring.configured,
  };

  const databaseReady = services.supabase;
  const paymentsEnabled = services.stripe;
  const healthy = databaseReady && paymentsEnabled;
  const provider = process.env.VERCEL
    ? 'vercel'
    : process.env.NETLIFY
      ? 'netlify'
      : 'unknown';
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    process.env.HEAD ||
    null;

  return {
    status: healthy ? 'ok' as const : 'degraded' as const,
    healthy,
    provider,
    commit,
    services,
    capabilities: {
      database: databaseReady,
      payments: paymentsEnabled,
      slicer: services.slicer,
    },
    configurationIssues: environment,
    checkedAt: new Date().toISOString(),
  };
}
