"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-10 w-10 text-destructive" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-destructive">
          Coś poszło nie tak
        </p>
        <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
          Nie udało się załadować tej części strony
        </h1>
        <p className="mb-8 text-muted-foreground">
          Spróbuj ponownie za chwilę. Jeśli problem wróci, napisz do nas — sprawdzimy to ręcznie.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Spróbuj ponownie
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Strona główna
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
