import { createClient } from '@supabase/supabase-js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createServiceRoleClient(
  url: string,
  serviceRoleKey: string,
  actorId?: string | null
) {
  const headers: Record<string, string> =
    actorId && UUID_PATTERN.test(actorId)
      ? { 'x-korix-actor-id': actorId }
      : {};

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { headers },
  });
}
