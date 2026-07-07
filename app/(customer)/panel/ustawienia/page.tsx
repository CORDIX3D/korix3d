'use client';

import { Settings } from 'lucide-react';
import { useAuth } from '@/lib/providers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PanelHeading } from '@/components/customer/panel-state';

export default function SettingsPage() {
  const { profile } = useAuth();
  return <div className="space-y-6"><PanelHeading title="Ustawienia" description="Dane przypisane do Twojego konta." /><Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" />Profil</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div><p className="text-sm text-muted-foreground">Imię i nazwisko</p><p className="mt-1 font-medium">{profile?.full_name || 'Nie podano'}</p></div><div><p className="text-sm text-muted-foreground">Adres e-mail</p><p className="mt-1 font-medium">{profile?.email || 'Nie podano'}</p></div><div className="sm:col-span-2 rounded-lg bg-secondary/60 p-4 text-sm text-muted-foreground">Edycja profilu zostanie udostępniona po wdrożeniu zabezpieczonego formularza danych konta. Zmianę danych możesz obecnie zgłosić przez kontakt.</div></CardContent></Card></div>;
}
