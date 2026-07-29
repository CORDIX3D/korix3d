import { createHash } from 'node:crypto';
import { getRequiredSupabaseServiceEnvironment } from '@/lib/env/server';

type RateLimitDatabaseError = {
  code?: string;
  message?: string;
};

type PersistentRateLimitResult = {
  data: boolean | null;
  error: RateLimitDatabaseError | null;
};

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string | null;
  consumePersistent?: (args: {
    p_scope: string;
    p_key_hash: string;
    p_limit: number;
    p_window_seconds: number;
  }) => Promise<PersistentRateLimitResult>;
};

type LocalWindow = {
  count: number;
  startedAt: number;
};

const localWindows = new Map<string, LocalWindow>();
const MISSING_FUNCTION_CODES = new Set(['42883', 'PGRST202']);

function requestAddress(request: Request) {
  return request.headers.get('x-nf-client-connection-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

function fingerprint(request: Request, scope: string, userId?: string | null) {
  const salt = getRequiredSupabaseServiceEnvironment()
    .SUPABASE_SERVICE_ROLE_KEY;
  const identity = userId
    ? `user:${userId}`
    : `anonymous:${requestAddress(request)}`;
  return createHash('sha256').update(`${salt}:${scope}:${identity}`).digest('hex');
}

function consumeLocalLimit(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = localWindows.get(key);

  if (!existing || now - existing.startedAt >= windowMs) {
    localWindows.set(key, { count: 1, startedAt: now });
    return { allowed: true, retryAfter: windowSeconds };
  }

  existing.count += 1;
  localWindows.set(key, existing);
  const retryAfter = Math.max(1, Math.ceil((windowMs - (now - existing.startedAt)) / 1000));

  if (localWindows.size > 5000) {
    for (const [entryKey, value] of localWindows) {
      if (now - value.startedAt >= windowMs) localWindows.delete(entryKey);
    }
  }

  return { allowed: existing.count <= limit, retryAfter };
}

export async function checkPublicRateLimit(request: Request, options: RateLimitOptions) {
  const keyHash = fingerprint(request, options.scope, options.userId);
  const localResult = consumeLocalLimit(
    `${options.scope}:${keyHash}`,
    options.limit,
    options.windowSeconds
  );

  if (!localResult.allowed || !options.consumePersistent) return localResult;

  try {
    const { data, error } = await options.consumePersistent({
      p_scope: options.scope,
      p_key_hash: keyHash,
      p_limit: options.limit,
      p_window_seconds: options.windowSeconds,
    });

    if (error) {
      if (!MISSING_FUNCTION_CODES.has(String(error.code || ''))) {
        console.warn('Persistent public rate limit unavailable:', error.code || 'unknown');
      }
      return localResult;
    }

    return {
      allowed: data === true,
      retryAfter: options.windowSeconds,
    };
  } catch {
    return localResult;
  }
}

export function rateLimitResponse(message: string, retryAfter: number) {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Retry-After': String(retryAfter),
    },
  });
}
