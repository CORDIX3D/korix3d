'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types/database';

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

  const supabase = createClient();

  const fetchProfile = useCallback(async (userId: string) => {
    try {
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
  }, [supabase]);

  useEffect(() => {
    let active = true;
    let sessionRequestId = 0;

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
        const { data: { session } } = await supabase.auth.getSession();
        await applySession(session);
      } catch (error) {
        console.error('Error getting session:', error);
        if (active) setLoading(false);
      }
    };

    void getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, nextSession: Session | null) => {
        // Do not await inside the callback: Supabase may hold its auth lock
        // until the callback returns.
        void applySession(nextSession);
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, supabase.auth]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        return { error: error as Error | null, role: null };
      }

      const profileData = await fetchProfile(data.user.id);
      setProfile(profileData);
      return { error: null, role: profileData?.role || 'customer' };
    } catch (err) {
      return { error: err as Error, role: null };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
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
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
