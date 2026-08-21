import { z } from 'zod';

function getUrlProtocol(value: string) {
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

const httpUrlSchema = z
  .string()
  .trim()
  .url('musi być poprawnym adresem URL')
  .refine((value) => {
    const protocol = getUrlProtocol(value);
    return protocol === 'http:' || protocol === 'https:';
  }, {
    message: 'musi używać protokołu HTTP lub HTTPS',
  });

const productionUrlSchema = httpUrlSchema.superRefine((value, context) => {
  if (
    process.env.NODE_ENV === 'production' &&
    getUrlProtocol(value) === 'http:'
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'musi używać HTTPS w środowisku produkcyjnym',
    });
  }
});

export const publicSupabaseEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: productionUrlSchema,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(20, 'ma nieprawidłową długość')
    .refine(
      (value) => value.startsWith('eyJ') || value.startsWith('sb_publishable_'),
      'nie jest kluczem anon/publishable Supabase'
    ),
});

export const supabaseServiceEnvironmentSchema = publicSupabaseEnvironmentSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .trim()
    .min(32, 'ma nieprawidłową długość')
    .refine(
      (value) => value.startsWith('eyJ') || value.startsWith('sb_secret_'),
      'nie jest kluczem service role/secret Supabase'
    ),
});

export const stripeEnvironmentSchema = z.object({
  STRIPE_SECRET_KEY: z
    .string()
    .trim()
    .regex(/^(sk|rk)_(test|live)_/, 'musi być serwerowym kluczem sk_ lub ograniczonym rk_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .trim()
    .regex(/^whsec_/, 'musi być sekretem podpisu whsec_'),
  NEXT_PUBLIC_SITE_URL: productionUrlSchema,
});

export const slicerWorkerEnvironmentSchema = z.object({
  CREALITY_SLICER_WORKER_PUBLIC_KEY: z
    .string()
    .trim()
    .regex(
      /^-----BEGIN PUBLIC KEY-----[\s\S]+-----END PUBLIC KEY-----$/,
      'musi być kluczem publicznym PEM'
    ),
});

export const monitoringEnvironmentSchema = z.object({
  CRON_SECRET: z
    .string()
    .trim()
    .min(32, 'musi mieć co najmniej 32 znaki')
    .regex(/^\S+$/, 'nie może zawierać białych znaków'),
});

export type PublicSupabaseEnvironment = z.infer<
  typeof publicSupabaseEnvironmentSchema
>;

export function formatEnvironmentIssues(error: z.ZodError) {
  return error.issues.map((issue) => {
    const name = issue.path.join('.') || 'środowisko';
    return `${name}: ${issue.message}`;
  });
}
