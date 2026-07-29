import 'server-only';
import {
  formatEnvironmentIssues,
  slicerServerEnvironmentSchema,
  stripeEnvironmentSchema,
  supabaseServiceEnvironmentSchema,
} from '@/lib/env/schema';

export class EnvironmentConfigurationError extends Error {
  readonly issues: string[];

  constructor(service: string, issues: string[]) {
    super(`Nieprawidłowa konfiguracja ${service}: ${issues.join('; ')}`);
    this.name = 'EnvironmentConfigurationError';
    this.issues = issues;
  }
}

function parseRequired<T>(
  service: string,
  result: { success: true; data: T } | { success: false; error: Parameters<typeof formatEnvironmentIssues>[0] }
) {
  if (result.success) return result.data;
  throw new EnvironmentConfigurationError(
    service,
    formatEnvironmentIssues(result.error)
  );
}

export function getRequiredSupabaseServiceEnvironment() {
  return parseRequired(
    'Supabase',
    supabaseServiceEnvironmentSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    })
  );
}

export function getRequiredStripeEnvironment() {
  return parseRequired(
    'Stripe',
    stripeEnvironmentSchema.safeParse({
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    })
  );
}

export function getRequiredSlicerServerEnvironment() {
  return parseRequired(
    'zdalnego slicera',
    slicerServerEnvironmentSchema.safeParse({
      CREALITY_SLICER_WORKER_TOKEN:
        process.env.CREALITY_SLICER_WORKER_TOKEN,
    })
  );
}

export function inspectServerEnvironment() {
  const supabase = supabaseServiceEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const stripe = stripeEnvironmentSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  const slicer = slicerServerEnvironmentSchema.safeParse({
    CREALITY_SLICER_WORKER_TOKEN:
      process.env.CREALITY_SLICER_WORKER_TOKEN,
  });

  return {
    supabase: {
      configured: supabase.success,
      issues: supabase.success ? [] : formatEnvironmentIssues(supabase.error),
    },
    stripe: {
      configured: stripe.success,
      issues: stripe.success ? [] : formatEnvironmentIssues(stripe.error),
    },
    slicer: {
      configured: slicer.success,
      issues: slicer.success ? [] : formatEnvironmentIssues(slicer.error),
    },
  };
}

