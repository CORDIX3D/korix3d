import {
  formatEnvironmentIssues,
  publicSupabaseEnvironmentSchema,
  type PublicSupabaseEnvironment,
} from '@/lib/env/schema';

export type PublicSupabaseEnvironmentState = {
  configured: boolean;
  values: PublicSupabaseEnvironment | null;
  issues: string[];
};

export function inspectPublicSupabaseEnvironment(): PublicSupabaseEnvironmentState {
  const input = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  const parsed = publicSupabaseEnvironmentSchema.safeParse(input);

  if (parsed.success) {
    return { configured: true, values: parsed.data, issues: [] };
  }

  return {
    configured: false,
    values: null,
    issues: formatEnvironmentIssues(parsed.error),
  };
}

