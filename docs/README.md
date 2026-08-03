# Dokumentacja produkcyjna KORIX3D

## Od czego zacząć

1. [Wdrożenie](WDROZENIE.md) — pełna kolejność konfiguracji Supabase, Vercel, Stripe i workera.
2. [Operacje](OPERACJE.md) — checklista wydania, monitoring, rollback i obsługa awarii.
3. [Testy produkcyjne](PRODUCTION_TESTS.md) — bezpieczne testy tylko do odczytu i macierz pełnego odbioru.
4. `PRODUCTION_READY_REPORT.md` w katalogu głównym — aktualny, dowodowy stan gotowości całego systemu.

## Platforma i integracje

- [Supabase](SUPABASE_PRODUCTION.md) — migracje, RLS, Auth, Storage i kontrola zdalna.
- [Stripe](STRIPE_PRODUCTION.md) — test/live, webhook, idempotencja, zwroty i reakcja na błędy.
- [Vercel](VERCEL_PRODUCTION.md) — projekt, środowiska, zmienne, wdrożenie i rollback.
- [Domena](DOMENA_PRODUCTION.md) — DNS, domena kanoniczna, HTTPS i przekierowanie `www`.
- [Worker Creality Print](WORKER_PRODUCTION.md) — host Windows, profile, retry, heartbeat i odbiór.

## Dane i ciągłość działania

- [Architektura](ARCHITEKTURA.md) — komponenty, przepływy krytyczne, tabele i granice zaufania.
- [Backup i odtwarzanie](BACKUP_I_ODTWARZANIE.md) — kopia bazy/Storage, szyfrowanie, próba odtworzenia i retencja.
- [Monitoring](MONITORING.md) — health checks, logi, alerty i prywatność.

## Jakość produkcyjna

- [Wydajność](PERFORMANCE.md) — budżety JavaScript, obrazy, cache i Core Web Vitals.
- [SEO](SEO.md) — canonical, sitemap, robots, schema.org oraz Google/Bing.
- [Bezpieczeństwo](BEZPIECZENSTWO.md) — role, RLS, CSP, CSRF, sekrety, zależności i incydenty.

## Zasady utrzymania

- Nie wpisuj sekretów do dokumentacji, Git ani wiadomości. Używaj wyłącznie nazw zmiennych.
- Nie zmieniaj wdrożonej migracji; dodaj nową migrację naprawczą.
- Nie uruchamiaj testów tworzących dane ani testowych płatności na produkcji bez kontrolowanego scenariusza.
- Po każdej zmianie funkcjonalnej uruchom lint, typecheck, testy i build; wdrożenie wymaga zielonego CI.
- Każda zmiana schematu wymaga świeżej kopii oraz próby na stagingu.
