# PRODUCTION READY REPORT — KORIX3D

Data audytu: 12 sierpnia 2026
Domena: `https://korix3d.pl`  
Gałąź: `main`  
Commit raportu: bieżący `HEAD` gałęzi `main`

## Werdykt

**NIEGOTOWE DO PEŁNEJ PRODUKCJI — 96/100.**

Kod aplikacji jest wdrożony na Vercel, ostatnie opublikowane CI GitHub jest zielone, a produkcyjny audyt npm zwraca 0 podatności. Stripe działa wyłącznie w trybie testowym, aktywny webhook słucha sześciu wymaganych zdarzeń (w tym `charge.refunded`), a `/api/health` zwraca HTTP 200. Produkcyjny Supabase został zabezpieczony wewnętrzną kopią, zaktualizowany migracjami i zweryfikowany pod kątem tabel, kolumn, RLS, polityk oraz Storage. Panel klienta i 16 kluczowych widoków administratora przeszły odbiór. Aplikacja KORIX3D działa jako instalowana bezpośrednio z przeglądarki PWA na iPhone oraz Windows. Stały worker Creality Print działa jako zadanie Windows, ma aktywny heartbeat i zakończył cztery rzeczywiste wyceny 3MF. Wieloczęściowe 3MF są obsługiwane, a ciężka konwersja działa poza głównym wątkiem. Rzeczywiste lokalne cięcie STL, OBJ i STEP również przeszło; STEP jest bezpłatnie konwertowany przez FreeCAD przed analizą w Creality. Pozostają: zewnętrzna kopia i próba odtworzenia, naprawa historii migracji, realny test Stripe Checkout oraz pełny staging. Stripe live pozostaje wyłączony.

## Podsumowanie wykonawcze

- Build Next.js 15.5.21 przechodzi i generuje 63 strony statyczne oraz komplet tras dynamicznych/API.
- Lint, TypeScript, skan sekretów, kontrakty env/Supabase/Stripe/Vercel/domeny/monitoringu/backupu/workera/testów/wydajności/SEO/bezpieczeństwa/dokumentacji oraz budżety JavaScript przechodzą lokalnie.
- GitHub zawiera 61 uporządkowanych migracji, w tym obie ostatnie migracje zastosowane już w produkcji. Kontrola RLS obejmuje 44 tabele. Produkcja ma 51 tabel publicznych, wszystkie z RLS, 124 polityki i 4 wymagane buckety Storage.
- Zidentyfikowano 65 plików stron i 40 route handlerów API.
- KORIX AI działa lokalnie na regułach i danych magazynowych; repozytorium nie wymaga OpenAI API ani płatnego AI.
- Publiczna strona główna działa na `korix3d.pl`; test przeglądarkowy nie wykrył `Application error`.
- Rozjazd schematu produkcyjnego Supabase został usunięty; wszystkie tabele i kolumny wymagane przez typy aplikacji są obecne.
- Konto właściciela ma rolę `admin`; dashboard i 15 kluczowych modułów administratora otwierają się bez błędu danych.
- Supabase Auth używa `https://korix3d.pl`, ma dwa dokładne redirecty, potwierdzenie e-mail, bezpieczną zmianę hasła, wymaganie bieżącego hasła i minimum 8 znaków.
- Ostatni zweryfikowany commit funkcjonalny `main` (`415bba0`) ma zielone GitHub CI i jest wdrożony przez Vercel ze statusem `READY`; obsługuje `korix3d.pl` i ma pozytywny status Vercel w GitHub.
- Vercel ma wymagane zmienne Supabase, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` i publiczny klucz podpisu workera. Worker uwierzytelnia się podpisem asymetrycznym, więc wspólny token nie jest wymagany.

## Stan 15 etapów

| Etap | Zakres | Kod/procedury | Dowód zewnętrzny | Status |
| --- | --- | --- | --- | --- |
| 1 | Audyt repozytorium | struktura, trasy, konfiguracja i ryzyka rozpoznane | repo i build sprawdzone | Zakończony |
| 2 | Environment | pełny `.env.example`, walidacja Zod i kontrola CI | wymagane zmienne aplikacji oraz podpis asymetryczny workera skonfigurowane | Zakończony |
| 3 | Supabase | 61 migracji po bieżącej publikacji, RLS, indeksy, FK, Storage i testy pgTAP | 51 tabel, 124 polityki, 0 tabel bez RLS, 4 buckety; obie ostatnie migracje działają w produkcji | Częściowo |
| 4 | Stripe | checkout, podpisany/idempotentny webhook, zwroty i dokumentacja | aktywny test mode i webhook 6 zdarzeń skonfigurowane; pełny checkout oczekuje, ponieważ sklep ma 0 aktywnych produktów | Częściowo |
| 5 | Vercel | `vercel.json`, Node 20, build i instrukcja rollbacku | produkcyjny redeploy `Ready`, domena i sekrety testowe podłączone | Zakończony |
| 6 | Domena | canonical apex, redirect `www`, HTTPS/HSTS w kodzie | CNAME aktywny w home.pl, certyfikat TLS aktywny, Vercel `Valid Configuration`, redirect 308 potwierdzony | Zakończony |
| 7 | Monitoring | health, chroniony cron, logi bez płatnego dostawcy | `CRON_SECRET` dodany; `/api/health` zwraca 200 | Zakończony |
| 8 | Backup | eksport DB/Storage, obowiązkowe szyfrowanie `age`, checksumy i automatyczne usuwanie jawnych danych | wewnętrzna kopia 31 tabel/278 rekordów wykonana; próbne szyfrowanie, odszyfrowanie i kontrola kompletności PASS; rzeczywisty zewnętrzny eksport i restore bazy oczekują | Częściowo |
| 9 | Worker Creality | timeout, retry, heartbeat, panel produkcji, zadanie Windows, profile, zgodność 3MF i most FreeCAD dla STEP | worker online; 4 rzeczywiste wyceny 3MF; lokalny pipeline STL, OBJ i STEP zaliczony | Zakończony lokalnie |
| 10 | Testy produkcyjne | read-only smoke i macierz 20 obszarów | pełny smoke 12/12 PASS na desktopie i mobile; panel klienta 8/8 i kluczowe widoki admina 16/16 PASS | Częściowo |
| 11 | Wydajność | obrazy, lazy AI, projekcje Supabase, deduplikacja i budżety JS | strona główna renderowana serwerowo; Supabase/Zod usunięte z anonimowego manifestu; smoke skrócony z 90 do 57,5 s; stabilne dane terenowe Core Web Vitals oczekują | Częściowo |
| 12 | SEO | canonical, sitemap, robots, manifest i pełne schema.org | kod SEO wdrożony; Google/Bing niezweryfikowane | Częściowo |
| 13 | Bezpieczeństwo | role, RLS, CSRF, CSP, webhook, upload, Dependabot, security.txt | ACL funkcji Supabase naprawione; `nanoid` 3.3.17, audyt produkcyjny 0 podatności i zielone CI | Zakończony |
| 14 | Dokumentacja | 16 kontrolowanych dokumentów operacyjnych | spójność potwierdzona skryptem | Zakończony |
| 15 | Raport końcowy | niniejszy raport i jednoznaczne kryteria odbioru | gotowość produkcyjna nieosiągnięta | Raport zakończony |

## Wyniki komend

| Kontrola | Wynik | Uwagi |
| --- | --- | --- |
| `npm run lint` | PASS | zero ostrzeżeń |
| `npm run typecheck` | PASS | TypeScript bez błędów |
| `npm run build` | PASS | Next.js 15.5.21, 63 strony statyczne |
| `npm run check:bundle` | PASS | publiczne ≤ 900 kB, admin ≤ 1,2 MB według manifestu |
| `npm run check:secrets` | PASS | brak rozpoznanych kluczy w plikach projektu |
| `npm run check:rls` | PASS | 44 tabele objęte kontrolą RLS |
| pozostałe `check:*` | PASS | env, Supabase, Stripe, Vercel, domena, monitoring, backup, worker, test plan, performance, SEO, security, docs |
| `npm test` | PASS | 5 plików, 57/57 testów |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 podatności produkcyjnych; `nanoid` przypięty do 3.3.17 |
| lokalne Playwright E2E | PASS | 18/18 PASS sekwencyjnie na desktopie i mobile po optymalizacji sesji, listy życzeń i AI |
| produkcyjny Playwright smoke | PASS | 12/12 PASS na desktopie i mobile, ponownie wykonany 12.08.2026 w 57,5 s |
| pełne CI GitHub | PASS | commit `415bba0`, przebieg `31594397120`; wszystkie kontrole, build i E2E PASS; status Vercel `success` |
| Lighthouse mobile — SEO / dostępność / dobre praktyki | PASS | 100 / 94 / 100; wynik performance nie jest bramką odbioru, ponieważ lokalny Chrome nie sprząta profilu (`EPERM`) i kolejne pomiary są niestabilne |
| test zaszyfrowanej kopii | PASS | `age` 1.3.1; szyfrowanie, SHA-256, odszyfrowanie, rozpakowanie, walidacja manifestu i sprzątanie na sztucznych danych |

## Testy działającej witryny

Stan sprawdzony w zalogowanej przeglądarce i testach automatycznych 3–12 sierpnia 2026:

| Obszar | Wynik | Dowód |
| --- | --- | --- |
| Strona główna | PASS | tytuł, jeden H1, brak `Application error` |
| KORIX AI | PASS częściowy | wcześniej potwierdzona odpowiedź na podstawie widocznych filamentów; brak płatnego API |
| `/panel` | PASS | poprawne podsumowanie konta, 2 zamówienia i wartość 230 zł |
| 7 zakładek `/panel/*` | PASS | zamówienia, wyceny, lista życzeń, pliki, powiadomienia, wiadomości i ustawienia bez błędów |
| `/admin` | PASS | poprawny dashboard właściciela z rolą `admin` |
| 16 kluczowych `/admin/*` | PASS | zamówienia, wyceny, produkcja, katalog, magazyn, filamenty, dostawa, historia, slicer, AI, księgowość, raporty i ustawienia bez błędów |
| `/api/health` | PASS | HTTP 200, `{"status":"ok"}`; CSP/HSTS i `no-store` poprawne |
| Logi Vercel — ostatnie 24 h | PASS | brak zgrupowanych błędów runtime |
| Aplikacja Windows | PASS | bezpośrednia instalacja PWA jednym przyciskiem z Edge/Chrome, bez ZIP-a, skryptów i uprawnień administratora |
| Aplikacja iPhone | PASS | manifest HTTP 200, `start_url=/admin/produkcja`, `display=standalone` |
| Automatyczna wycena Creality | PASS dla 3MF | worker online; rzeczywisty model 701 428 trójkątów przygotowany w 11,07 s; 4 ukończone wyceny 3MF; kolejka 0/0/0 |
| Lokalny pipeline STL | PASS | kostka 10 mm: 174 s, 0,66 g, 50 warstw |
| Lokalny pipeline OBJ | PASS | kostka 10 mm: 174 s, 0,66 g, 50 warstw |
| Lokalny pipeline STEP | PASS | publiczna kostka jCAE, SHA-256 `3831666D50D58D79769D38D2730DE02C91B9882E41BE26980EE912EE5CD01B00`; FreeCAD → STL → Creality: 9 s, 0,01 g, 10 warstw |
| `korix3d.pl` DNS | PASS | rekord A `76.76.21.21` |
| `www.korix3d.pl` DNS i HTTPS | PASS | CNAME `b157fac3bf0a0f6a.vercel-dns-017.com`, TTL 60; Vercel `Valid Configuration`; aktywny TLS i redirect 308 do `https://korix3d.pl/` |

Przed migracjami utworzono schemat `backup_pre_mvp_20260803`: 31 kopii tabel (29 publicznych oraz metadane `storage.buckets` i `storage.objects`), 278 rekordów i około 1,9 MB. Następnie zastosowano w jednej transakcji bazowy komplet 59 migracji, a migrację `20260807130133_restrict_security_definer_execution` zastosowano i zapisano w historii Supabase osobno. Produkcja ma 51 tabel publicznych, 124 polityki, 0 tabel bez RLS i buckety `accounting-reports`, `cms-media`, `product-images`, `quote-files`. Po migracji tylko 1 funkcja `SECURITY DEFINER` jest dostępna dla `anon`, 7 dla `authenticated`, a 19 dla `service_role`; produkcyjny smoke ponownie przeszedł 12/12.

## Krytyczne blokady przed produkcją

1. Wykonać przygotowanym skryptem rzeczywisty zewnętrzny, zaszyfrowany eksport bazy i Storage oraz próbne odtworzenie poza produkcją. Automatyczne szyfrowanie i kontrola artefaktu są przetestowane; eksport oczekuje na bezpiecznie przekazane hasło połączenia bazy i docelowy klucz `age`, oba poza repozytorium i rozmową.
2. Naprawić historię wcześniejszych migracji oficjalnym `supabase migration repair`, aby przyszłe `db push` nie próbowało ich ponawiać.
3. Przeprowadzić pełny checkout w Stripe test mode, webhook, retry, wygaśnięcie, zwrot stanu i refund.
4. Wykonać pełną macierz akceptacyjną na stagingu i obserwować produkcję minimum 30 minut.

## Kolejność bezpiecznego uruchomienia

1. Vercel `READY` i zielone CI GitHub dla `415bba0` — wykonane.
2. Wewnętrzna kopia Supabase, migracje, RLS, Storage i health — wykonane.
3. DNS `www`, HTTPS i redirect 308 — wykonane; pozostały zewnętrzny backup i oficjalna naprawa historii migracji.
4. Staging: pełne testy formularzy, paneli, magazynu, wyceny i Stripe test.
5. Produkcja bez Stripe live: testy logowania, paneli i kontrolowany checkout testowy.
6. Worker Creality Print: utrzymać stały host i heartbeat; lokalne testy STL, STEP, OBJ i 3MF wykonane.
7. Stripe live dopiero po pełnym odbiorze: osobne klucze, osobny webhook, mała płatność i refund.
8. Obserwacja logów, webhooków, stanów magazynowych i kolejki przez minimum 30 minut.

## Git i wdrożenie

Ostatni zweryfikowany commit funkcjonalny `main` to `415bba0`. GitHub Actions `31594397120` zakończył wszystkie kontrole powodzeniem. Produkcyjne wdrożenie Vercel `dpl_6Nb1JHzJnXHXfgUeBBSXyBEDmQSA` ma status `READY`, pozytywny status GitHub i obsługuje aliasy produkcyjne. Wdrożony zestaw zawiera obsługę wieloczęściowych 3MF, izolację ciężkiej konwersji, ograniczenie pamięci, zweryfikowany most FreeCAD dla STEP, obowiązkowo szyfrowany eksport DB/Storage oraz optymalizację publicznego ładowania Supabase. Strona główna jest renderowana serwerowo z pięciominutowym odświeżaniem, anonimowy ruch nie pobiera klienta Supabase ani Zod, a bot pobiera wyłącznie publiczne `greeting` i `enabled` z cache'owanego endpointu — bez ujawniania `system_prompt`. Po wdrożeniu produkcyjny smoke przeszedł 12/12 w 57,5 s.

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
