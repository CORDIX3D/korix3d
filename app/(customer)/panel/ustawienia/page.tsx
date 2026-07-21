'use client';

import Link from 'next/link';
import { Mail, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PanelHeading } from '@/components/customer/panel-state';

export default function SettingsPage() {
  const { profile } = useAuth();
  const hasName = Boolean(profile?.full_name?.trim());

  return (
    <div className="space-y-6">
      <PanelHeading title="Ustawienia" description="Dane przypisane do Twojego konta klienta." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <UserRound className="h-4 w-4" />
                Imię i nazwisko
              </div>
              <p className="font-medium">{profile?.full_name || 'Nie podano'}</p>
              {!hasName && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Uzupełnienie imienia ułatwi obsługę wycen i zamówień.
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Adres e-mail
              </div>
              <p className="break-all font-medium">{profile?.email || 'Nie podano'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold text-foreground">Zmiana danych konta</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Edycja profilu klienta będzie dostępna po wdrożeniu dodatkowej weryfikacji. Do tego czasu zmiany
                  danych możesz zgłosić przez formularz kontaktowy — dzięki temu unikamy przypadkowych zmian przy
                  aktywnych zamówieniach.
                </p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button asChild>
                    <Link href="/kontakt?temat=dane-konta">Zgłoś zmianę danych</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/wycena">Rozpocznij wycenę</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
