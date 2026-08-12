'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const AuthenticatedPublicSessionActions = dynamic(
  () => import('./authenticated-public-session-actions').then(
    (module) => module.AuthenticatedPublicSessionActions
  ),
  { ssr: false }
);

function hasStoredSession() {
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

function AnonymousActions() {
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link href="/logowanie">Zaloguj się</Link>
      </Button>
      <Button asChild size="sm" className="hidden bg-gradient-primary transition-shadow hover:shadow-glow sm:inline-flex">
        <Link href="/rejestracja">Zarejestruj się</Link>
      </Button>
    </div>
  );
}

export function PublicSessionActions() {
  const [sessionPresent, setSessionPresent] = useState(false);

  useEffect(() => {
    setSessionPresent(hasStoredSession());
  }, []);

  return sessionPresent
    ? <AuthenticatedPublicSessionActions />
    : <AnonymousActions />;
}
