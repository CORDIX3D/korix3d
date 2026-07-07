import { createBrowserClient } from '@supabase/ssr';

// If Supabase env vars are present, use real client. Otherwise provide a
// lightweight local fallback that stores `products` and `categories` in
// `localStorage` so the UI can be tested in development without external DB.
function createLocalFallback() {
  // helper to read/write localStorage safely
  const read = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const write = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  };

  const createQuery = (name: string, initialData: any[]) => {
    let selectedCols: string | undefined;
    let filters: Array<{ type: 'eq' | 'in'; field: string; value: any }> = [];
    let orderBy: { field: string; ascending: boolean } | null = null;
    let limitCount: number | null = null;
    let singleMode = false;
    let maybeSingleMode = false;

    const applyFilters = (items: any[]) => {
      return items.filter((item) => {
        return filters.every((filter) => {
          if (filter.type === 'eq') {
            return item[filter.field] === filter.value;
          }
          if (filter.type === 'in') {
            return Array.isArray(filter.value) && filter.value.includes(item[filter.field]);
          }
          return true;
        });
      });
    };

    const applySelect = (items: any[]) => {
      if (!selectedCols || selectedCols.trim() === '*' || selectedCols.trim() === '') {
        return items;
      }
      const cols = selectedCols
        .split(',')
        .map((col) => col.trim())
        .filter(Boolean);
      return items.map((item) => {
        const record: any = {};
        cols.forEach((col) => {
          if (col in item) {
            record[col] = item[col];
          }
        });
        return record;
      });
    };

    const execute = async () => {
      let result = [...initialData];
      result = applyFilters(result);
      if (orderBy) {
        const activeOrderBy = orderBy;
        result = result.sort((a, b) => {
          const aValue = a[activeOrderBy.field];
          const bValue = b[activeOrderBy.field];
          if (aValue == null && bValue == null) return 0;
          if (aValue == null) return 1;
          if (bValue == null) return -1;
          if (aValue < bValue) return activeOrderBy.ascending ? -1 : 1;
          if (aValue > bValue) return activeOrderBy.ascending ? 1 : -1;
          return 0;
        });
      }
      if (limitCount !== null) {
        result = result.slice(0, limitCount);
      }
      if (singleMode || maybeSingleMode) {
        result = result[0] || null;
      }
      result = applySelect(Array.isArray(result) ? result : result ? [result] : []);
      return { data: singleMode || maybeSingleMode ? result[0] || null : result, error: null };
    };

    const query: any = {
      select(cols?: string) {
        selectedCols = cols;
        return query;
      },
      eq(field: string, value: any) {
        filters.push({ type: 'eq', field, value });
        return query;
      },
      in(field: string, values: any[]) {
        filters.push({ type: 'in', field, value: values });
        return query;
      },
      order(field: string, opts: { ascending?: boolean }) {
        orderBy = { field, ascending: opts?.ascending ?? true };
        return query;
      },
      limit(count: number) {
        limitCount = count;
        return query;
      },
      single() {
        singleMode = true;
        return query;
      },
      maybeSingle() {
        maybeSingleMode = true;
        return query;
      },
      async execute() {
        return execute();
      },
      then(resolve: any, reject: any) {
        return execute().then(resolve, reject);
      },
    };

    return query;
  };

  const table = (name: string) => {
    return {
      select: (cols?: string) => createQuery(name, read(name)).select(cols),
      insert: (items: any[]) => {
        const operation = async () => {
          const current = read(name);
          const next = items.map((item, index) => ({
            ...item,
            id: item.id || `${Date.now()}-${index}`,
            ...(name === 'orders_3d' && !item.order_number
              ? { order_number: `DEV-${Date.now().toString().slice(-8)}` }
              : {}),
          }));
          const result = write(name, [...next, ...current]);
          return { data: result.error ? null : next, error: result.error };
        };
        const chain = {
          select: () => ({
            single: async () => {
              const result = await operation();
              return { data: result.data?.[0] || null, error: result.error };
            },
          }),
          then: (resolve: (value: any) => void, reject: (reason: any) => void) => operation().then(resolve, reject),
        };
        return chain;
      },
      update: async (payload: any) => {
        const current = read(name);
        const updated = current.map((it: any) => (it.id === payload.id ? { ...it, ...payload } : it));
        return write(name, updated);
      },
      delete: async (predicate: (item: any) => boolean) => {
        const current = read(name);
        const filtered = current.filter((it: any) => !predicate(it));
        return write(name, filtered);
      },
      eq: function () {
        // naive chainable stub for server-side calls in middleware — not used here
        return this;
      },
      single: async () => {
        const data = read(name)[0] || null;
        return { data, error: null };
      },
    };
  };

  return {
    from: (name: string) => table(name),
    storage: {
      from: (_bucket: string) => ({
        upload: async (path: string, file: File) => ({ data: { path, size: file.size }, error: null }),
        remove: async (_paths: string[]) => ({ data: [], error: null }),
        createSignedUrl: async (_path: string) => ({ data: null, error: new Error('Podgląd pliku wymaga połączenia z Supabase Storage.') }),
      }),
    },
    rpc: async (name: string, args: Record<string, any>) => {
      const orders = read('orders_3d');
      const userRaw = localStorage.getItem('dev_auth_user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      if (name === 'finalize_quote_files') {
        let finalized = false;
        const updated = orders.map((order: any) => {
          if (order.id === args.p_order_id && order.user_id === user?.id && order.status === 'new' && Array.isArray(order.files) && order.files.length === 0) {
            finalized = true;
            return { ...order, files: args.p_files, updated_at: new Date().toISOString() };
          }
          return order;
        });
        write('orders_3d', updated);
        return { data: finalized, error: null };
      }

      if (name === 'discard_incomplete_quote') {
        const filtered = orders.filter((order: any) => !(order.id === args.p_order_id && order.user_id === user?.id && order.status === 'new' && Array.isArray(order.files) && order.files.length === 0));
        const discarded = filtered.length !== orders.length;
        write('orders_3d', filtered);
        return { data: discarded, error: null };
      }

      if (name !== 'accept_order_quote') return { data: null, error: new Error(`Unknown local RPC: ${name}`) };
      let accepted = false;
      const updated = orders.map((order: any) => {
        if (order.id === args.p_order_id && order.user_id === user?.id && order.status === 'quoted') {
          accepted = true;
          return { ...order, status: 'accepted', updated_at: new Date().toISOString() };
        }
        return order;
      });
      write('orders_3d', updated);
      return { data: accepted, error: null };
    },
    auth: {
      // Simple dev auth stored in localStorage under 'dev_auth_user'
      getSession: async () => {
        try {
          const raw = localStorage.getItem('dev_auth_user');
          const user = raw ? JSON.parse(raw) : null;
          return { data: { session: user ? { user } : null }, error: null };
        } catch (err) {
          return { data: { session: null }, error: err };
        }
      },
      getUser: async () => {
        try {
          const raw = localStorage.getItem('dev_auth_user');
          const user = raw ? JSON.parse(raw) : null;
          return { data: { user }, error: null };
        } catch (err) {
          return { data: { user: null }, error: err };
        }
      },
      signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
        try {
          // Accept any credentials in dev and persist a simple user
          const user = { id: `dev_${Date.now()}`, email, role: 'customer' };
          localStorage.setItem('dev_auth_user', JSON.stringify(user));
          // notify any listeners via simple event
          window.dispatchEvent(new CustomEvent('dev-auth-change', { detail: { event: 'SIGNED_IN', session: { user } } }));
          return { data: { session: { user } }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signUp: async ({ email, password, options }: any) => {
        try {
          const user = { id: `dev_${Date.now()}`, email, role: 'customer', full_name: options?.data?.full_name || null };
          localStorage.setItem('dev_auth_user', JSON.stringify(user));
          window.dispatchEvent(new CustomEvent('dev-auth-change', { detail: { event: 'SIGNED_IN', session: { user } } }));
          return { data: { user }, error: null };
        } catch (err) {
          return { data: null, error: err };
        }
      },
      signOut: async () => {
        try {
          localStorage.removeItem('dev_auth_user');
          window.dispatchEvent(new CustomEvent('dev-auth-change', { detail: { event: 'SIGNED_OUT' } }));
          return { error: null };
        } catch (err) {
          return { error: err };
        }
      },
      resetPasswordForEmail: async (_email: string, _opts: any) => ({ error: null }),
      onAuthStateChange: (cb: any) => {
        const handler = (e: any) => cb(e.detail.event, e.detail.session);
        window.addEventListener('dev-auth-change', handler as EventListener);
        return { data: { subscription: { unsubscribe: () => window.removeEventListener('dev-auth-change', handler as EventListener) } } };
      },
    },
  } as any;
}

export function createClient() {
  // Never call createBrowserClient on the server — only create it in the browser
  // when env vars are present. On the server return a safe stub.
  if (typeof window === 'undefined') {
    return {
      from: (_name: string) => ({
        select: async () => ({ data: [], error: null }),
        insert: async () => ({ data: null, error: null }),
        update: async () => ({ data: null, error: null }),
        eq: () => ({ single: async () => ({ data: null, error: null }) }),
      }),
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      rpc: async () => ({ data: null, error: new Error('RPC is unavailable on the server fallback') }),
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: new Error('Storage is unavailable on the server fallback') }),
          remove: async () => ({ data: null, error: null }),
          createSignedUrl: async () => ({ data: null, error: new Error('Storage is unavailable on the server fallback') }),
        }),
      },
    } as any;
  }
  // We're in the browser. If env vars are provided, use the real Supabase client;
  // otherwise use the localStorage fallback for dev/testing.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  // @ts-ignore
  return createLocalFallback();
}

// Legacy export for backwards compatibility
export const supabase = createClient();
