# PRODUCTION READY REPORT — KORIX3D

Data audytu: 3 sierpnia 2026  
Domena: `https://korix3d.pl`  
Gałąź: `main`  
Commit raportu: bieżący `HEAD` gałęzi `main`

## Werdykt

**NIEGOTOWE DO PEŁNEJ PRODUKCJI — 85/100.**

Kod, migracje, zabezpieczenia i procedury są zapisane w GitHub, a produkcyjne wdrożenie Vercel ma status `Ready`. Stripe działa wyłącznie w trybie testowym, nowy klucz zastąpił ujawniony sekret, webhook słucha pięciu wymaganych zdarzeń, a `/api/health` zwraca HTTP 200. Produkcyjny Supabase został zabezpieczony wewnętrzną kopią, zaktualizowany kompletem migracji i zweryfikowany pod kątem tabel, kolumn, RLS, polityk oraz Storage. Pozostają: rekord DNS `www` u operatora home.pl, zewnętrzna kopia i próba odtworzenia, pełny odbiór paneli, realny test Stripe Checkout oraz stały worker Creality Print. Stripe live pozostaje wyłączony.

## Podsumowanie wykonawcze

- Build Next.js 15.5.21 przechodzi i generuje 61 stron statycznych oraz komplet tras dynamicznych/API.
- Lint, TypeScript, skan sekretów, kontrakty env/Supabase/Stripe/Vercel/domeny/monitoringu/backupu/workera/testów/wydajności/SEO/bezpieczeństwa/dokumentacji oraz budżety JavaScript przechodzą lokalnie.
- Repozytorium zawiera 59 uporządkowanych migracji i lokalnie kontroluje RLS dla 44 tabel. Produkcja ma 51 tabel publicznych, wszystkie z RLS, 124 polityki i 4 wymagane buckety Storage.
- Zidentyfikowano 64 pliki stron i 37 route handlerów API.
- KORIX AI działa lokalnie na regułach i danych magazynowych; repozytorium nie wymaga OpenAI API ani płatnego AI.
- Publiczna strona główna działa na `korix3d.pl`; test przeglądarkowy nie wykrył `Application error`.
- Rozjazd schematu produkcyjnego Supabase został usunięty; wszystkie tabele i kolumny wymagane przez typy aplikacji są obecne.
- Próba wejścia na `/admin` przekierowuje testowane konto do `/panel`; pełny panel administratora nie został odebrany.
- Supabase Auth używa `https://korix3d.pl`, ma dwa dokładne redirecty, potwierdzenie e-mail, bezpieczną zmianę hasła, wymaganie bieżącego hasła i minimum 8 znaków.
- GitHub `main` był zsynchronizowany przed migracją naprawczą, a automatyczne wdrożenia Vercel z `main` mają status `Ready` i obsługują `korix3d.pl`.
- Vercel ma wymagane zmienne Supabase, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`. Brakuje wyłącznie tokenu stałego workera slicera.

## Stan 15 etapów

| Etap | Zakres | Kod/procedury | Dowód zewnętrzny | Status |
| --- | --- | --- | --- | --- |
| 1 | Audyt repozytorium | struktura, trasy, konfiguracja i ryzyka rozpoznane | repo i build sprawdzone | Zakończony |
| 2 | Environment | pełny `.env.example`, walidacja Zod i kontrola CI | wymagane zmienne aplikacji obecne poza tokenem workera | Częściowo |
| 3 | Supabase | 59 migracji, RLS, indeksy, FK, Storage i testy pgTAP | 51 tabel, 124 polityki, 0 tabel bez RLS, 4 buckety; zgodność typów potwierdzona | Zakończony |
| 4 | Stripe | checkout, podpisany/idempotentny webhook, zwroty i dokumentacja | test mode, nowy klucz i webhook 5 zdarzeń skonfigurowane; pełny checkout oczekuje | Częściowo |
| 5 | Vercel | `vercel.json`, Node 20, build i instrukcja rollbacku | produkcyjny redeploy `Ready`, domena i sekrety testowe podłączone | Zakończony |
| 6 | Domena | canonical apex, redirect `www`, HTTPS/HSTS w kodzie | `www` dodane w Vercel z 308; oczekuje CNAME w home.pl | Częściowo |
| 7 | Monitoring | health, chroniony cron, logi bez płatnego dostawcy | `CRON_SECRET` dodany; `/api/health` zwraca 200 | Zakończony |
| 8 | Backup | eksport DB/Storage, checksumy i próba restore | wewnętrzna kopia 31 tabel/278 rekordów wykonana; zewnętrzny eksport i restore oczekują | Częściowo |
| 9 | Worker Creality | timeout, retry, heartbeat, instalator Windows i profile | host oraz realne formaty nieodebrane | Blokada |
| 10 | Testy produkcyjne | read-only smoke i macierz 20 obszarów | 10/12 smoke PASS; 2 błędy wyłącznie przez brak DNS `www`; panele/Stripe/worker oczekują | Częściowo |
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
| `npm test` | PASS | 4 pliki, 49/49 testów |
| `npm audit --omit=dev --audit-level=high` | BLOCKED | ograniczone środowisko nie połączyło się z endpointem npm; brak wyniku nie oznacza braku podatności |
| produkcyjny Playwright smoke | PARTIAL | 10/12 PASS; oba błędy dotyczą wyłącznie `www.korix3d.pl` bez rekordu DNS |
| pełne CI GitHub | PASS | workflow #58 dla `9bdcb51`, 2 min 42 s |

## Testy działającej witryny

Stan sprawdzony w zalogowanej przeglądarce 3 sierpnia 2026:

| Obszar | Wynik | Dowód |
| --- | --- | --- |
| Strona główna | PASS | tytuł, jeden H1, brak `Application error` |
| KORIX AI | PASS częściowy | wcześniej potwierdzona odpowiedź na podstawie widocznych filamentów; brak płatnego API |
| `/panel` | DO PONOWNEGO ODBIORU | brakujące tabele zostały dodane; wymagany test zalogowanego klienta |
| `/panel/zamowienia` | DO PONOWNEGO ODBIORU | schemat naprawiony; wymagany test danych konta |
| `/admin` | BLOCKED | przekierowanie do `/panel`; konto nie ma roli admin |
| `/api/health` | PASS | HTTP 200, `{"status":"ok"}`; CSP/HSTS i `no-store` poprawne |
| `korix3d.pl` DNS | PASS | rekord A `76.76.21.21` |
| `www.korix3d.pl` DNS | FAIL | domena i redirect 308 są w Vercel; brakuje CNAME u operatora home.pl |

Przed migracjami utworzono schemat `backup_pre_mvp_20260803`: 31 kopii tabel (29 publicznych oraz metadane `storage.buckets` i `storage.objects`), 278 rekordów i około 1,9 MB. Następnie zastosowano w jednej transakcji komplet 59 migracji. Produkcja ma 51 tabel publicznych, 124 polityki, 0 tabel bez RLS i buckety `accounting-reports`, `cms-media`, `product-images`, `quote-files`. Automatyczne porównanie z `lib/types/database.ts` nie wykazało brakujących tabel ani kolumn.

## Krytyczne blokady przed produkcją

1. Dodać w home.pl rekord CNAME `www` wskazany przez Vercel i potwierdzić redirect 308.
2. Wykonać zewnętrzny, zaszyfrowany eksport bazy i Storage oraz próbne odtworzenie poza produkcją.
3. Naprawić historię `supabase_migrations` oficjalnym `supabase migration repair`, aby przyszłe `db push` nie próbowało ponawiać migracji.
4. Ponownie odebrać wszystkie moduły panelu klienta i administratora po migracjach.
5. Uruchomić worker na stałym hoście Windows z rzeczywistym Creality Print i odebrać STL, STEP, OBJ oraz 3MF.
6. Przeprowadzić pełny checkout w Stripe test mode, webhook, retry, wygaśnięcie, zwrot stanu i refund.
7. Wykonać pełną macierz akceptacyjną na stagingu i obserwować produkcję minimum 30 minut.

## Kolejność bezpiecznego uruchomienia

1. GitHub, zielone CI i Vercel — wykonane dla poprzedniego `HEAD`; migracja naprawcza oczekuje na commit i CI.
2. Wewnętrzna kopia Supabase, migracje, RLS, Storage i health — wykonane.
3. DNS `www`, zewnętrzny backup i oficjalna naprawa historii migracji.
4. Staging: pełne testy formularzy, paneli, magazynu, wyceny i Stripe test.
5. Produkcja bez Stripe live: testy logowania, paneli i kontrolowany checkout testowy.
6. Worker Creality Print: stały host, token, heartbeat i test czterech formatów.
7. Stripe live dopiero po pełnym odbiorze: osobne klucze, osobny webhook, mała płatność i refund.
8. Obserwacja logów, webhooków, stanów magazynowych i kolejki przez minimum 30 minut.

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
