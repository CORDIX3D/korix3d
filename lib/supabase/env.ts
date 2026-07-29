import { inspectPublicSupabaseEnvironment } from '@/lib/env/public';
import {
  EnvironmentConfigurationError,
  getRequiredSupabaseServiceEnvironment,
} from '@/lib/env/server';

export class SupabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigurationError';
  }
}

export function isSupabaseConfigurationError(
  error: unknown
): error is SupabaseConfigurationError {
  return error instanceof SupabaseConfigurationError
    || error instanceof EnvironmentConfigurationError;
}

export function getSupabaseEnv() {
  const environment = inspectPublicSupabaseEnvironment();

  return {
    url: environment.values?.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: environment.values?.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    isConfigured: environment.configured,
    issues: environment.issues,
  };
}

export function getRequiredSupabaseEnv() {
  const env = getSupabaseEnv();
  if (!env.isConfigured) {
    throw new SupabaseConfigurationError(
      `Nieprawidłowa konfiguracja Supabase: ${env.issues.join('; ')}`
    );
  }
  return env;
}

export function getRequiredSupabaseServiceEnv() {
  const environment = getRequiredSupabaseServiceEnvironment();

  return {
    url: environment.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
  };
}
