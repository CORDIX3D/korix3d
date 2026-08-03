# PRODUCTION READY REPORT — KORIX3D

Data audytu: 3 sierpnia 2026  
Domena: `https://korix3d.pl`  
Gałąź: `main`  
Commit raportu: bieżący `HEAD` gałęzi `main`

## Werdykt

**NIEGOTOWE DO PEŁNEJ PRODUKCJI — 72/100.**

Kod, migracje, zabezpieczenia i procedury są zapisane w GitHub, zielone CI potwierdziło commit `9bdcb51`, a dokładnie ten commit działa na Vercel ze statusem `Ready`. Produkcyjny Supabase ma jednak tylko 29 tabel aplikacyjnych i nie ma historii migracji ani backupu, podczas gdy aplikacja odwołuje się do 18 brakujących tabel. Panel klienta nadal zwraca błędy danych, `www.korix3d.pl` nie istnieje w DNS, Stripe i worker nie są skonfigurowane, a publiczny health zwraca HTTP 503. Włączenie płatności live lub uruchomienie migracji bez kopii przed usunięciem tych blokad jest zabronione.

## Podsumowanie wykonawcze

- Build Next.js 15.5.21 przechodzi i generuje 61 stron statycznych oraz komplet tras dynamicznych/API.
- Lint, TypeScript, skan sekretów, kontrakty env/Supabase/Stripe/Vercel/domeny/monitoringu/backupu/workera/testów/wydajności/SEO/bezpieczeństwa/dokumentacji oraz budżety JavaScript przechodzą lokalnie.
- Repozytorium zawiera 58 uporządkowanych migracji i lokalnie kontroluje RLS dla 44 tabel. Produkcja ma 29 tabel publicznych, wszystkie z RLS, oraz 52 polityki.
- Zidentyfikowano 64 pliki stron i 37 route handlerów API.
- KORIX AI działa lokalnie na regułach i danych magazynowych; repozytorium nie wymaga OpenAI API ani płatnego AI.
- Publiczna strona główna działa na `korix3d.pl`; test przeglądarkowy nie wykrył `Application error`.
- Produkcyjny panel klienta nie pobiera podsumowania ani zamówień. Logi Supabase potwierdzają odpowiedzi 404 dla brakujących tabel, więc nie jest to już hipoteza.
- Próba wejścia na `/admin` przekierowuje testowane konto do `/panel`; pełny panel administratora nie został odebrany.
- Supabase Auth używa `https://korix3d.pl`, ma dwa dokładne redirecty, potwierdzenie e-mail, bezpieczną zmianę hasła, wymaganie bieżącego hasła i minimum 8 znaków.
- GitHub `main` jest zsynchronizowany, CI dla bazowego commita funkcjonalnego `9bdcb51` jest zielone, a automatyczne wdrożenia Vercel z `main` mają status `Ready` i obsługują `korix3d.pl`.
- Vercel ma pięć z ośmiu wymaganych zmiennych: trzy Supabase, `NEXT_PUBLIC_SITE_URL` i wygenerowany `CRON_SECRET`. Brakuje Stripe oraz tokenu workera.

## Stan 15 etapów

| Etap | Zakres | Kod/procedury | Dowód zewnętrzny | Status |
| --- | --- | --- | --- | --- |
| 1 | Audyt repozytorium | struktura, trasy, konfiguracja i ryzyka rozpoznane | repo i build sprawdzone | Zakończony |
| 2 | Environment | pełny `.env.example`, walidacja Zod i kontrola CI | potwierdzono 5/8 wymaganych zmiennych Vercel | Częściowo |
| 3 | Supabase | 58 migracji, RLS, indeksy, FK, Storage i testy pgTAP | produkcja: 29 tabel, brak historii migracji, 18 brakujących tabel, 2 buckety i brak backupu | Blokada |
| 4 | Stripe | checkout, podpisany/idempotentny webhook, zwroty i dokumentacja | test mode/live i webhook zdalny nieodebrane | Częściowo |
| 5 | Vercel | `vercel.json`, Node 20, build i instrukcja rollbacku | GitHub `main` i domena podłączone, deploymenty `Ready`; env niekompletne | Częściowo |
| 6 | Domena | canonical apex, redirect `www`, HTTPS/HSTS w kodzie | apex DNS działa; brak DNS `www` | Częściowo |
| 7 | Monitoring | health, chroniony cron, logi bez płatnego dostawcy | `CRON_SECRET` dodany; `/api/health` zwraca 503 przez brak Stripe | Częściowo |
| 8 | Backup | eksport DB/Storage, checksumy i próba restore | realna zaszyfrowana kopia i restore nie wykonane | Blokada |
| 9 | Worker Creality | timeout, retry, heartbeat, instalator Windows i profile | host oraz realne formaty nieodebrane | Blokada |
| 10 | Testy produkcyjne | read-only smoke i macierz 20 obszarów | panel klienta błędny; admin/Stripe/worker/staging nieodebrane | Blokada |
| 11 | Wydajność | obrazy, lazy AI, projekcje Supabase, deduplikacja i budżety JS | Core Web Vitals po wdrożeniu oczekują | Zakończony lokalnie |
| 12 | SEO | canonical, sitemap, robots, manifest i pełne schema.org | kod SEO wdrożony; Google/Bing niezweryfikowane | Częściowo |
| 13 | Bezpieczeństwo | role, RLS, CSRF, CSP, webhook, upload, Dependabot, security.txt | CI i nagłówki produkcyjne potwierdzone; `npm audit` bez wyniku | Częściowo |
| 14 | Dokumentacja | 16 kontrolowanych dokumentów operacyjnych | spójność potwierdzona skryptem | Zakończony |
| 15 | Raport końcowy | niniejszy raport i jednoznaczne kryteria odbioru | gotowość produkcyjna nieosiągnięta | Raport zakończony |

## Wyniki komend

| Kontrola | Wynik | Uwagi |
| --- | --- | --- |
| `npm run lint` | PASS | zero ostrzeżeń |
| `npm run typecheck` | PASS | TypeScript bez błędów |
| `npm run build` | PASS | Next.js 15.5.21, 61 stron statycznych |
| `npm run check:bundle` | PASS | publiczne ≤ 900 kB, admin ≤ 1,2 MB według manifestu |
| `npm run check:secrets` | PASS | brak rozpoznanych kluczy w plikach projektu |
| `npm run check:rls` | PASS | 44 tabele objęte kontrolą RLS |
| pozostałe `check:*` | PASS | env, Supabase, Stripe, Vercel, domena, monitoring, backup, worker, test plan, performance, SEO, security, docs |
| `npm test` | BLOCKED | Vitest/esbuild nie może odczytać katalogu nadrzędnego w lokalnym sandboxie; testy nie wystartowały |
| `npm audit --omit=dev --audit-level=high` | BLOCKED | ograniczone środowisko nie połączyło się z endpointem npm; brak wyniku nie oznacza braku podatności |
| lokalny Playwright E2E | INCONCLUSIVE | scenariusze dochodziły do oczekiwanych widoków, lecz procesy przeglądarki nie kończyły się poprawnie w sandboxie |
| pełne CI GitHub | PASS | workflow #58 dla `9bdcb51`, 2 min 42 s |

## Testy działającej witryny

Stan sprawdzony w zalogowanej przeglądarce 3 sierpnia 2026:

| Obszar | Wynik | Dowód |
| --- | --- | --- |
| Strona główna | PASS | tytuł, jeden H1, brak `Application error` |
| KORIX AI | PASS częściowy | wcześniej potwierdzona odpowiedź na podstawie widocznych filamentów; brak płatnego API |
| `/panel` | FAIL | „Nie udało się pobrać danych” |
| `/panel/zamowienia` | FAIL | po zakończeniu ładowania pojawia się błąd pobierania danych |
| `/admin` | BLOCKED | przekierowanie do `/panel`; konto nie ma roli admin |
| `/api/health` | FAIL | HTTP 503, `{"status":"degraded"}`; nagłówki CSP/HSTS i `no-store` są poprawne |
| `korix3d.pl` DNS | PASS | rekord A `76.76.21.21` |
| `www.korix3d.pl` DNS | FAIL | brak rekordu CNAME/A |

Przyczyną błędów panelu jest potwierdzony rozjazd schematu produkcyjnego Supabase. Brakuje: `accounting_reports`, `ai_conversations`, `ai_file_uploads`, `ai_logs`, `ai_messages`, `ai_notifications`, `ai_scores_history`, `ai_settings`, `executive_reports`, `messages`, `monthly_trends`, `order_status_history`, `product_reviews`, `public_api_rate_limits`, `slicer_workers`, `slicing_jobs`, `stock_movements` i `stripe_webhook_events`. Logi pokazują odpowiedzi 404 m.in. dla modułów księgowości, raportów i AI. Storage ma tylko `cms-media` i `quote-files`; brakuje `product-images` oraz `accounting-reports`.

## Krytyczne blokady przed produkcją

1. Wykonać zewnętrzny backup obecnego Supabase, zastosować kontrolowanie brakujące migracje i uruchomić testy RLS na stagingu.
2. Naprawić i ponownie odebrać wszystkie moduły panelu klienta po migracjach.
3. Zapewnić kontrolowane konto z rolą `admin` i odebrać panel administratora moduł po module.
4. Dodać nowe klucze Stripe test bezpośrednio w panelach oraz token workera; potwierdzić `/api/health` i chroniony monitoring.
5. Utworzyć rekord `www` i przypisać domenę w Vercel; potwierdzić stałe przekierowanie do apex.
6. Wykonać zaszyfrowany backup bazy i Storage oraz próbne odtworzenie poza produkcją.
7. Uruchomić worker na stałym hoście Windows z rzeczywistym Creality Print i odebrać STL, STEP, OBJ oraz 3MF.
8. Przeprowadzić pełny checkout w Stripe test mode, webhook, retry, wygaśnięcie, zwrot stanu i refund. Dopiero potem osobno skonfigurować live.
9. Wykonać pełną macierz akceptacyjną na stagingu i bezpieczny smoke na produkcji.

## Kolejność bezpiecznego uruchomienia

1. GitHub, zielone CI i Vercel dla `9bdcb51` — wykonane.
2. Backup obecnego Supabase — oczekuje.
3. Staging: migracje, RLS, Auth, Storage, konta testowe i worker.
4. Staging: pełne testy formularzy, paneli, magazynu, wyceny i Stripe test.
5. Produkcyjny Supabase: kontrolowane brakujące migracje.
6. Vercel: uzupełnić Stripe/worker, ponownie wdrożyć i potwierdzić health/monitoring.
7. Produkcja bez Stripe live: testy odczytu, logowanie i panele.
8. Stripe live: nowe klucze i nowy webhook dodane bezpośrednio w panelach, mała kontrolowana płatność i refund.
9. Obserwacja logów, webhooków, stanów magazynowych i kolejki przez minimum 30 minut.

## Git i wdrożenie

Gałąź `main` jest zsynchronizowana z `CORDIX3D/korix3d`. GitHub Actions workflow #58 dla bazowego commita funkcjonalnego `9bdcb51` zakończył się powodzeniem, a Vercel automatycznie wdraża kolejne commity dokumentacyjne z `main` jako produkcję dla `korix3d.pl`.

Zmiany lokalne obejmują osobne commity dla: bazowego wdrożenia, env, Supabase, Stripe, Vercel, domeny, monitoringu, backupu, workera, testów produkcyjnych, wydajności, SEO, bezpieczeństwa i dokumentacji.

## Sekrety i koszty

- Nie zapisano kluczy w repozytorium.
- Klucze wcześniej przekazane w rozmowie są ujawnione i muszą pozostać unieważnione.
- Nie należy przesyłać nowych kluczy na czacie; wpisuje się je bezpośrednio w Supabase, Vercel lub Stripe.
- KORIX AI nie używa OpenAI ani innego płatnego modelu.
- Monitoring nie wymaga płatnego Sentry.
- Płatności Stripe live pozostają wyłączone do pełnego odbioru.

## Kryterium „production ready”

Werdykt można zmienić na **GOTOWE** dopiero, gdy wszystkie blokady powyżej mają bezpośredni dowód: zielony commit w GitHub, zgodny i zbackupowany Supabase, działające oba panele, poprawny DNS, health/monitoring, działający worker, pozytywny Stripe test i pełny odbiór staging/production. Sam zielony build lokalny nie jest wystarczającym dowodem.
