import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 text-center">
      <div className="max-w-lg">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <SearchX className="h-10 w-10 text-primary" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">Błąd 404</p>
        <h1 className="mb-4 text-3xl font-bold sm:text-4xl">Nie znaleziono strony</h1>
        <p className="mb-8 text-muted-foreground">Podany adres jest nieaktualny albo strona została przeniesiona.</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild><Link href="/">Strona główna</Link></Button>
          <Button asChild variant="outline"><Link href="/kontakt">Skontaktuj się</Link></Button>
        </div>
      </div>
    </div>
  );
}
