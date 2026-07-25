function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export function getRuntimeHealth() {
  const services = {
    supabaseUrl: configured('NEXT_PUBLIC_SUPABASE_URL'),
    supabasePublicKey: configured('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceKey: configured('SUPABASE_SERVICE_ROLE_KEY'),
    stripeSecretKey: configured('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: configured('STRIPE_WEBHOOK_SECRET'),
    siteUrl: configured('NEXT_PUBLIC_SITE_URL'),
  };

  const databaseReady =
    services.supabaseUrl &&
    services.supabasePublicKey &&
    services.supabaseServiceKey;
  const anyStripeKey =
    services.stripeSecretKey || services.stripeWebhookSecret;
  const paymentsEnabled =
    services.stripeSecretKey &&
    services.stripeWebhookSecret &&
    services.siteUrl;
  const paymentsPartiallyConfigured =
    anyStripeKey && !paymentsEnabled;
  const healthy = databaseReady && !paymentsPartiallyConfigured;
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
    },
    checkedAt: new Date().toISOString(),
  };
}
