# PRODUCTION READY REPORT — KORIX3D

Data audytu: 3 sierpnia 2026  
Domena: `https://korix3d.pl`  
Gałąź: `main`  
Commit raportu: bieżący `HEAD` gałęzi `main`

## Werdykt

**NIEGOTOWE DO PEŁNEJ PRODUKCJI — 67/100.**

Kod, migracje, zabezpieczenia i procedury są przygotowane lokalnie, ale najnowsze zmiany nie są jeszcze w GitHub ani we wdrożeniu. Produkcyjny panel klienta zwraca błędy danych, konto użyte do testów nie ma roli administratora, `www.korix3d.pl` nie istnieje w DNS, a zdalne Supabase, Vercel, Stripe, backup i worker nie przeszły pełnego odbioru. Włączenie płatności live przed usunięciem tych blokad jest zabronione.

## Podsumowanie wykonawcze

- Build Next.js 15.5.21 przechodzi i generuje 61 stron statycznych oraz komplet tras dynamicznych/API.
- Lint, TypeScript, skan sekretów, kontrakty env/Supabase/Stripe/Vercel/domeny/monitoringu/backupu/workera/testów/wydajności/SEO/bezpieczeństwa/dokumentacji oraz budżety JavaScript przechodzą lokalnie.
- RLS jest wykryty dla 44 tabel; repozytorium zawiera 58 uporządkowanych migracji.
- Zidentyfikowano 64 pliki stron i 37 route handlerów API.
- KORIX AI działa lokalnie na regułach i danych magazynowych; repozytorium nie wymaga OpenAI API ani płatnego AI.
- Publiczna strona główna działa na `korix3d.pl`; test przeglądarkowy nie wykrył `Application error`.
- Produkcyjny panel klienta nie pobiera podsumowania ani zamówień. Jest to twarda blokada wdrożenia.
- Próba wejścia na `/admin` przekierowuje testowane konto do `/panel`; pełny panel administratora nie został odebrany.
- Lokalna gałąź jest przed `origin/main`; najnowsze etapy nie są jeszcze wdrożone.

## Stan 15 etapów

| Etap | Zakres | Kod/procedury | Dowód zewnętrzny | Status |
| --- | --- | --- | --- | --- |
| 1 | Audyt repozytorium | struktura, trasy, konfiguracja i ryzyka rozpoznane | repo i build sprawdzone | Zakończony |
| 2 | Environment | pełny `.env.example`, walidacja Zod i kontrola CI | wartości Vercel niezweryfikowane | Częściowo |
| 3 | Supabase | 58 migracji, RLS, indeksy, FK, Storage i testy pgTAP | panel produkcyjny zwraca błędy; migracje zdalne nieporównane | Blokada |
| 4 | Stripe | checkout, podpisany/idempotentny webhook, zwroty i dokumentacja | test mode/live i webhook zdalny nieodebrane | Częściowo |
| 5 | Vercel | `vercel.json`, Node 20, build i instrukcja rollbacku | projekt/env/najnowszy deployment niezweryfikowane | Częściowo |
| 6 | Domena | canonical apex, redirect `www`, HTTPS/HSTS w kodzie | apex DNS działa; brak DNS `www` | Częściowo |
| 7 | Monitoring | health, chroniony cron, logi bez płatnego dostawcy | cron/env/alert na Vercel nieodebrane | Częściowo |
| 8 | Backup | eksport DB/Storage, checksumy i próba restore | realna zaszyfrowana kopia i restore nie wykonane | Blokada |
| 9 | Worker Creality | timeout, retry, heartbeat, instalator Windows i profile | host oraz realne formaty nieodebrane | Blokada |
| 10 | Testy produkcyjne | read-only smoke i macierz 20 obszarów | panel klienta błędny; admin/Stripe/worker/staging nieodebrane | Blokada |
| 11 | Wydajność | obrazy, lazy AI, projekcje Supabase, deduplikacja i budżety JS | Core Web Vitals po wdrożeniu oczekują | Zakończony lokalnie |
| 12 | SEO | canonical, sitemap, robots, manifest i pełne schema.org | nowe SEO niewdrożone; Google/Bing niezweryfikowane | Częściowo |
| 13 | Bezpieczeństwo | role, RLS, CSRF, CSP, webhook, upload, Dependabot, security.txt | `npm audit` i CI oczekują na środowisko sieciowe | Częściowo |
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
| pełne CI GitHub | PENDING | nowe commity nie są jeszcze wysłane |

## Testy działającej witryny

Stan sprawdzony w zalogowanej przeglądarce 3 sierpnia 2026:

| Obszar | Wynik | Dowód |
| --- | --- | --- |
| Strona główna | PASS | tytuł, jeden H1, brak `Application error` |
| KORIX AI | PASS częściowy | wcześniej potwierdzona odpowiedź na podstawie widocznych filamentów; brak płatnego API |
| `/panel` | FAIL | „Nie udało się pobrać danych” |
| `/panel/zamowienia` | FAIL | po zakończeniu ładowania pojawia się błąd pobierania danych |
| `/admin` | BLOCKED | przekierowanie do `/panel`; konto nie ma roli admin |
| `/api/health` | NIEZWERYFIKOWANE | bezpośrednie otwarcie JSON jest blokowane przez narzędzie przeglądarkowe, nie przez potwierdzony błąd aplikacji |
| `korix3d.pl` DNS | PASS | rekord A `76.76.21.21` |
| `www.korix3d.pl` DNS | FAIL | brak rekordu CNAME/A |

Najbardziej prawdopodobną przyczyną błędów panelu jest rozjazd schematu lub RLS produkcyjnego Supabase względem 58 migracji w repozytorium. To hipoteza do potwierdzenia przez porównanie historii migracji i logów Supabase; nie należy uruchamiać migracji w ciemno.

## Krytyczne blokady przed produkcją

1. Wysłać wszystkie lokalne commity do `CORDIX3D/korix3d`, uzyskać zielone GitHub Actions i wdrożyć dokładnie zatwierdzony commit.
2. Zalogować się do Supabase, wykonać backup, porównać historię migracji, zastosować wyłącznie brakujące migracje i uruchomić testy RLS na stagingu.
3. Naprawić i ponownie odebrać wszystkie moduły panelu klienta.
4. Zapewnić kontrolowane konto z rolą `admin` i odebrać panel administratora moduł po module.
5. Ustawić komplet ośmiu wymaganych zmiennych Vercel, potwierdzić `/api/health`, chroniony monitoring i brak sekretów w logach.
6. Utworzyć rekord `www` i przypisać domenę w Vercel; potwierdzić stałe przekierowanie do apex.
7. Wykonać zaszyfrowany backup bazy i Storage oraz próbne odtworzenie poza produkcją.
8. Uruchomić worker na stałym hoście Windows z rzeczywistym Creality Print i odebrać STL, STEP, OBJ oraz 3MF.
9. Przeprowadzić pełny checkout w Stripe test mode, webhook, retry, wygaśnięcie, zwrot stanu i refund. Dopiero potem osobno skonfigurować live.
10. Wykonać pełną macierz akceptacyjną na stagingu i bezpieczny smoke na produkcji.

## Kolejność bezpiecznego uruchomienia

1. GitHub i zielone CI.
2. Backup obecnego Supabase.
3. Staging: migracje, RLS, Auth, Storage, konta testowe i worker.
4. Staging: pełne testy formularzy, paneli, magazynu, wyceny i Stripe test.
5. Produkcyjny Supabase: kontrolowane brakujące migracje.
6. Vercel: env, domeny, deployment konkretnego commita, health i monitoring.
7. Produkcja bez Stripe live: testy odczytu, logowanie i panele.
8. Stripe live: nowe klucze i nowy webhook dodane bezpośrednio w panelach, mała kontrolowana płatność i refund.
9. Obserwacja logów, webhooków, stanów magazynowych i kolejki przez minimum 30 minut.

## Git i wdrożenie

Przed utworzeniem commita raportu lokalna gałąź była **14 commitów przed `origin/main`** i 0 commitów za nią. `origin/main` wskazywał `1bdc8e1`, a ostatni lokalny commit dokumentacji `73de1b1`. Po zapisaniu niniejszego raportu gałąź jest 15 commitów przed `origin/main`.

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
