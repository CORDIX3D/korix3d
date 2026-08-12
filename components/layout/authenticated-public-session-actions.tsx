'use client';

import Link from 'next/link';
import { ChevronDown, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthProvider, useAuth, useOptionalAuth } from '@/lib/providers';

function SessionMenu() {
  const { user, profile, signOut, isAdmin, isEmployee, loading } = useAuth();

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-lg bg-secondary" aria-label="Ładowanie konta" />;
  }

  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/logowanie">Zaloguj się</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <User className="h-4 w-4 text-primary" />
          </div>
          <span className="hidden text-sm font-medium md:inline">
            {profile?.full_name || 'Konto'}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-border bg-card">
        <DropdownMenuItem asChild>
          <Link href="/panel" className="cursor-pointer">Panel klienta</Link>
        </DropdownMenuItem>
        {(isAdmin || isEmployee) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="cursor-pointer text-primary">
                Panel administracyjny
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive"
          onClick={() => void signOut()}
        >
          Wyloguj się
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AuthenticatedPublicSessionActions() {
  const existingAuth = useOptionalAuth();

  if (existingAuth) return <SessionMenu />;

  return (
    <AuthProvider>
      <SessionMenu />
    </AuthProvider>
  );
}
