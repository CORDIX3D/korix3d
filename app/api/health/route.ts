import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const services = {
    supabaseUrl: configured('NEXT_PUBLIC_SUPABASE_URL'),
    supabasePublicKey: configured('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceKey: configured('SUPABASE_SERVICE_ROLE_KEY'),
    stripeSecretKey: configured('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: configured('STRIPE_WEBHOOK_SECRET'),
    siteUrl: configured('NEXT_PUBLIC_SITE_URL'),
  };
  const healthy = Object.values(services).every(Boolean);
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

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      provider,
      commit,
      services,
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
