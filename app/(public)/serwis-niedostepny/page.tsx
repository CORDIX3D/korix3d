import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Panel chwilowo niedostępny',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ServiceUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo: requestedReturnTo } = await searchParams;
  const returnTo =
    requestedReturnTo?.startsWith('/admin') || requestedReturnTo?.startsWith('/panel')
      ? requestedReturnTo
      : '/';

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-xl border-border bg-card">
        <CardContent className="flex flex-col items-center p-8 text-center sm:p-10">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Panel jest chwilowo niedostępny
          </h1>
          <p className="mt-4 max-w-md text-muted-foreground">
            Nie możemy teraz bezpiecznie potwierdzić dostępu do panelu. Spróbuj ponownie za chwilę.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild>
              <Link href={returnTo}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Spróbuj ponownie
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Wróć na stronę główną
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
