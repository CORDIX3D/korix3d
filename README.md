# KORIX3D

Aplikacja Next.js 15 z panelem klienta i administratora, sklepem, wyceną druku 3D, Supabase oraz checkoutem Stripe.

## Uruchomienie lokalne

1. Skopiuj `.env.example` jako `.env.local`.
2. Uzupełnij wymagane zmienne środowiskowe bez zapisywania sekretów w Git.
3. Uruchom `npm ci`, a następnie `npm run dev`.

## Kontrola przed wdrożeniem

```text
npm run lint
npm run typecheck
npm run check:secrets
npm run build
```

Pełna kolejność konfiguracji Supabase, Stripe i Vercel znajduje się w [instrukcji wdrożenia](docs/WDROZENIE.md).
