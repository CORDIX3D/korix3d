import { createBrowserClient } from '@supabase/ssr';
import { inspectPublicSupabaseEnvironment } from '@/lib/env/public';

const SUPABASE_UNAVAILABLE_MESSAGE =
  'Usługa danych jest chwilowo niedostępna. Spróbuj ponownie później.';

function createUnavailableError() {
  const error = new Error(SUPABASE_UNAVAILABLE_MESSAGE);
  error.name = 'SupabaseUnavailableError';
  return error;
}

function createUnavailableQuery() {
  let query: any;
  query = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          return (
            resolve: (value: { data: null; error: Error }) => unknown,
            reject: (reason: unknown) => unknown
          ) =>
            Promise.resolve({
              data: null,
              error: createUnavailableError(),
            }).then(resolve, reject);
        }

        return () => query;
      },
    }
  );
  return query;
}

function createUnavailableClient() {
  return {
    from: () => createUnavailableQuery(),
    rpc: async () => ({ data: null, error: createUnavailableError() }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: createUnavailableError() }),
        remove: async () => ({ data: null, error: createUnavailableError() }),
        download: async () => ({ data: null, error: createUnavailableError() }),
        createSignedUrl: async () => ({
          data: null,
          error: createUnavailableError(),
        }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
    auth: {
      getSession: async () => ({
        data: { session: null },
        error: createUnavailableError(),
      }),
      getUser: async () => ({
        data: { user: null },
        error: createUnavailableError(),
      }),
      signInWithPassword: async () => ({
        data: { session: null, user: null },
        error: createUnavailableError(),
      }),
      signUp: async () => ({
        data: { session: null, user: null },
        error: createUnavailableError(),
      }),
      resend: async () => ({
        data: null,
        error: createUnavailableError(),
      }),
      signOut: async () => ({ error: createUnavailableError() }),
      resetPasswordForEmail: async () => ({
        data: null,
        error: createUnavailableError(),
      }),
      updateUser: async () => ({
        data: { user: null },
        error: createUnavailableError(),
      }),
      onAuthStateChange: () => ({
        data: {
          subscription: {
            unsubscribe: () => undefined,
          },
        },
      }),
    },
  } as any;
}

let cachedBrowserClient: ReturnType<typeof createBrowserClient> | null = null;
let cachedUnavailableClient: ReturnType<typeof createUnavailableClient> | null =
  null;

function getUnavailableClient() {
  cachedUnavailableClient ??= createUnavailableClient();
  return cachedUnavailableClient;
}

export function createClient() {
  // Never initialize a browser client while rendering on the server.
  if (typeof window === 'undefined') {
    return getUnavailableClient();
  }

  const environment = inspectPublicSupabaseEnvironment();
  if (environment.configured && environment.values) {
    cachedBrowserClient ??= createBrowserClient(
      environment.values.NEXT_PUBLIC_SUPABASE_URL,
      environment.values.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    return cachedBrowserClient;
  }

  return getUnavailableClient();
}

// Legacy export for backwards compatibility
export const supabase = createClient();
