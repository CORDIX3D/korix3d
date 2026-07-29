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
npm test
npm run check:db
npm run check:rls
npm run check:secrets
npm run build
npm run check:bundle
npm run test:smoke
npm run test:e2e:prebuilt
```

## Dokumentacja

- [Konfiguracja i wdrożenie](docs/WDROZENIE.md)
- [Architektura i przepływy danych](docs/ARCHITEKTURA.md)
- [Backup i odtwarzanie](docs/BACKUP_I_ODTWARZANIE.md)
- [Obsługa produkcji i awarii](docs/OPERACJE.md)

KORIX AI działa lokalnie i nie wymaga klucza OpenAI ani płatnego API.
