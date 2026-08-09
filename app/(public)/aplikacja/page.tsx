import type { Metadata } from 'next';
import Link from 'next/link';
import { Apple, ArrowRight, Download, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Aplikacja KORIX3D',
  description: 'Zainstaluj bezpieczną aplikację centrum produkcji KORIX3D na iPhone lub Windows.',
  alternates: { canonical: '/aplikacja' },
  manifest: '/production-app.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'KORIX3D Produkcja',
    statusBarStyle: 'black-translucent',
  },
};

export default function ApplicationDownloadPage() {
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.16),transparent_32rem)]">
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            Aplikacja <span className="text-gradient">KORIX3D</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Bezpieczny dostęp do kalkulacji, produkcji, zamówień i płatności na komputerze oraz telefonie.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden border-white/10 bg-zinc-900/75">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/10 p-3"><Apple className="h-7 w-7" /></div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">iPhone i iPad</span>
              </div>
              <h2 className="mt-6 text-2xl font-bold">Aplikacja na iOS</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Instalowana bezpiecznie z Safari jako aplikacja PWA. Nie wymaga App Store, profilu konfiguracyjnego ani dodatkowych opłat.
              </p>
              <ol className="mt-5 space-y-3 text-sm text-zinc-300">
                <li><strong className="mr-2 text-primary">1.</strong>Otwórz poniższy przycisk w Safari.</li>
                <li><strong className="mr-2 text-primary">2.</strong>Naciśnij ikonę „Udostępnij”.</li>
                <li><strong className="mr-2 text-primary">3.</strong>Wybierz „Do ekranu początkowego” i „Dodaj”.</li>
              </ol>
              <Button asChild className="mt-7 w-full">
                <Link href="/admin/produkcja">Otwórz aplikację na iPhone <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-zinc-900/90 to-orange-950/25">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-primary/15 p-3"><Monitor className="h-7 w-7 text-primary" /></div>
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">Windows 10/11</span>
              </div>
              <h2 className="mt-6 text-2xl font-bold">Aplikacja na Windows</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Wersja przenośna bez instalatora, PowerShella i uprawnień administratora. Uruchamia KORIX3D w osobnym oknie systemowym.
              </p>
              <div className="mt-5 rounded-xl border border-white/5 bg-black/20 p-4 text-sm text-zinc-300">
                Rozpakuj ZIP i kliknij dwukrotnie „KORIX3D.cmd”. To wszystko — nie trzeba niczego instalować.
              </div>
              <Button asChild className="mt-7 w-full">
                <a href="/downloads/KORIX3D-Windows.zip" download>
                  <Download className="mr-2 h-4 w-4" />Pobierz prostą wersję Windows
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mx-auto mt-8 flex max-w-3xl items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-100">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <p>Dostęp wymaga logowania, a dane produkcyjne są dostępne wyłącznie dla administratorów i pracowników KORIX3D.</p>
        </div>
      </section>
    </div>
  );
}
