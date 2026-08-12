'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types/database';

let browserClientPromise: Promise<SupabaseClient> | null = null;

function getBrowserClient() {
  browserClientPromise ??= import('@/lib/supabase/client').then(({ createClient }) =>
    createClient() as SupabaseClient
  );
  return browserClientPromise;
}

function hasStoredAuthSession() {
  try {
    const localSession = Object.keys(window.localStorage).some(
      (key) => key.startsWith('sb-') && key.includes('-auth-token')
    );
    const cookieSession = document.cookie
      .split(';')
      .some((cookie) => /^\s*sb-[^=]+-auth-token(?:\.\d+)?=/.test(cookie));
    return localSession || cookieSession;
  } catch {
    return false;
  }
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isCustomer: boolean;
  signIn: (email: string, password: string) => Promise<{
    error: Error | null;
    role: Profile['role'] | null;
  }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const supabase = await getBrowserClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error('Error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    let sessionRequestId = 0;
    let unsubscribe: (() => void) | undefined;

    if (!hasStoredAuthSession()) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const applySession = async (nextSession: Session | null) => {
      const requestId = ++sessionRequestId;

      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      const profileData = nextSession?.user
        ? await fetchProfile(nextSession.user.id)
        : null;

      if (!active || requestId !== sessionRequestId) return;

      setProfile(profileData);
      setLoading(false);
    };

    // Get initial session and set up auth listener.
    const getInitialSession = async () => {
      try {
        const supabase = await getBrowserClient();
        if (!active) return;

        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event: string, nextSession: Session | null) => {
            // Do not await inside the callback: Supabase may hold its auth lock
            // until the callback returns.
            void applySession(nextSession);
          }
        );
        unsubscribe = () => subscription.unsubscribe();
      } catch (error) {
        console.error('Error getting session:', error);
        if (active) setLoading(false);
      }
    };

    void getInitialSession();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const supabase = await getBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        return { error: error as Error | null, role: null };
      }

      const profileData = await fetchProfile(data.user.id);
      setSession(data.session);
      setUser(data.user);
      setProfile(profileData);
      return { error: null, role: profileData?.role || 'customer' };
    } catch (err) {
      return { error: err as Error, role: null };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const supabase = await getBrowserClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            typeof window !== 'undefined'
              ? `${window.location.origin}/auth/callback?next=/panel`
              : undefined,
          data: {
            full_name: fullName,
          },
        },
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    const supabase = await getBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const supabase = await getBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback?next=/reset-password`
            : undefined,
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isEmployee = profile?.role === 'admin' || profile?.role === 'employee';
  const isCustomer = profile?.role === 'customer';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        isAdmin,
        isEmployee,
        isCustomer,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useOptionalAuth();
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
