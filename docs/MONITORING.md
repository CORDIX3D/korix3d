# Monitoring produkcyjny KORIX3D

## Zakres

Monitoring korzysta z funkcji dostępnych w Vercel bez podłączania płatnego Sentry:

- Runtime Logs i Observability Vercel dla funkcji, middleware i zewnętrznych wywołań;
- Build Logs oraz obowiązkowy workflow CI dla błędów kompilacji;
- publiczny `/api/health` dla dostępności aplikacji;
- chroniony `/api/admin/health` dla kompletności konfiguracji;
- globalne error boundary i `/api/monitoring/client-error` dla błędów renderowania;
- codzienny `/api/monitoring/production-health` uruchamiany przez Vercel Cron.

Codzienna kontrola obejmuje API, połączenie z Supabase, wymagane buckety uploadu, błędy webhooków Stripe z ostatnich 24 godzin, zablokowane zadania slicera i aktualny heartbeat workera.

## Konfiguracja

1. Wygeneruj losowy `CRON_SECRET` o długości co najmniej 32 znaków.
2. Wstaw go wyłącznie do Vercel Production.
3. Wdróż ponownie aplikację i sprawdź `Settings → Cron Jobs`.
4. Harmonogram `0 5 * * *` działa raz dziennie o 05:00 UTC, więc jest zgodny także z ograniczeniem planu Hobby.
5. Nie wywołuj chronionego endpointu z przeglądarki i nie przesyłaj sekretu w query string.

Vercel wysyła sekret automatycznie jako `Authorization: Bearer …`. Endpoint bez poprawnego nagłówka zwraca 401 i nie ujawnia stanu infrastruktury.

## Logi i prywatność

Rekordy mają typ `korix3d_error` lub `korix3d_production_health`, identyfikator zdarzenia, źródło, wdrożenie i zanonimizowany opis. Sanitizer usuwa tokeny Bearer, adresy e-mail, klucze i długie ciągi przypominające sekrety.

Nie zapisuj treści webhooków Stripe, tokenów, numerów kart, zawartości plików 3D ani pełnych danych adresowych. Logi powinny pozwalać ustalić klasę błędu i identyfikator zamówienia, nie odtwarzać dane klienta.

## Widoki operacyjne Vercel

- `Logs`: filtruj `korix3d_error`, `korix3d_production_health`, `level:error` oraz konkretny `eventId`.
- `Observability → Vercel Functions`: sprawdzaj 5xx, liczbę wywołań, czas i pamięć według trasy.
- `Deployments`: sprawdzaj Build Logs i SHA wdrożenia.
- `Settings → Cron Jobs`: sprawdzaj ostatnie uruchomienie i log chronionej kontroli.

Nie włączaj płatnego Observability Plus ani automatycznego dochodzenia AI bez świadomej decyzji właściciela i sprawdzenia kosztów.

## Alerty i reakcja

Na planie bez płatnych alertów właściciel powinien włączyć powiadomienia e-mail GitHub Actions o nieudanym CI oraz codziennie sprawdzać wynik crona w okresie rozruchu. Jeżeli projekt przejdzie na Vercel Pro z Observability Plus, można włączyć alert 5xx i alert użycia, ale nie jest to wymagane do działania aplikacji.

Reakcja według pola `checks`:

- `supabase=false`: sprawdź status projektu, limity i sekrety Vercel;
- `upload=false`: sprawdź migracje bucketów i Supabase Storage;
- `stripe=false`: sprawdź nieprzetworzone eventy, podpis i dostawy w Stripe Workbench;
- `worker=false`: uruchom ponownie usługę Creality i sprawdź jej log;
- `backgroundJobs=false`: sprawdź zadania starsze niż 30 minut w `/admin/slicer`;
- `api=false` albo brak wywołania crona: sprawdź wdrożenie, domenę i Vercel Cron.

Po awarii zapisz czas, SHA wdrożenia, `eventId`, wpływ na klientów i wykonane działania. Procedurę cofnięcia zawiera `OPERACJE.md`.
