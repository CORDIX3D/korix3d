# PRODUCTION READY REPORT — KORIX3D

Data audytu: 13 sierpnia 2026
Domena: `https://korix3d.pl`  
Gałąź: `main`  
Commit raportu: bieżący `HEAD` gałęzi `main`

## Werdykt

**NIEGOTOWE DO PEŁNEJ PRODUKCJI — odbiór końcowy w toku.**

Kod aplikacji jest wdrożony na Vercel, ostatnie opublikowane CI GitHub jest zielone, a produkcyjny audyt npm zwraca 0 podatności. Stripe działa poprawnie w Sandbox, gdzie osobny webhook słucha sześciu wymaganych zdarzeń (w tym `charge.refunded`), a `/api/health` zwraca HTTP 200. Pełny test sklepu w Stripe Sandbox zakończył płatność i refund, a wykryty brak zwrotu stanu został naprawiony oraz sprawdzony idempotentnie. Wycena własnego projektu ma osobny Stripe Checkout, wymagany adres i automatyczne potwierdzenie webhookiem; płatność, anulowanie i pełny refund przeszły w Sandbox. Refund ustawił status `refunded`, wyzerował rezerwację 28,55 g i przywrócił magazyn dokładnie do 1971,450 g; ponowne wywołanie funkcji zwrotu nie zmieniło stanu. Dopłaty Express i Pilne są naliczane procentowo od kosztu realizacji przed dostawą i VAT; produkcyjna migracja Supabase jest zastosowana i przeszła test transakcyjny. Produkcyjny Supabase został zabezpieczony wewnętrzną i zewnętrzną szyfrowaną kopią, zaktualizowany migracjami i zweryfikowany pod kątem tabel, kolumn, RLS, polityk, Storage oraz pełnej historii 66 migracji. Panel klienta 8/8 i wszystkie 29 statycznych stron administratora przeszły wcześniejszy zalogowany odbiór. Aplikacja KORIX3D działa jako instalowana bezpośrednio z przeglądarki PWA na iPhone oraz Windows. Stały worker Creality Print działa jako zadanie Windows i zakończył cztery rzeczywiste wyceny 3MF. Pozostają: pełne odtworzenie danych poza produkcją, końcowy zalogowany odbiór stagingu oraz prawidłowa konfiguracja i test Stripe Live.

## Podsumowanie wykonawcze

- Build Next.js 15.5.21 przechodzi i generuje 63 strony statyczne oraz komplet tras dynamicznych/API.
- Lint, TypeScript, skan sekretów, kontrakty env/Supabase/Stripe/Vercel/domeny/monitoringu/backupu/workera/testów/wydajności/SEO/bezpieczeństwa/dokumentacji oraz budżety JavaScript przechodzą lokalnie.
- Lokalny zestaw i produkcyjna historia Supabase zawierają te same 66 uporządkowanych migracji. Oficjalny `supabase migration repair --status applied` uzupełnił 59 brakujących wpisów wyłącznie w tabeli historii, bez ponownego uruchamiania SQL. Kontrola RLS obejmuje 44 tabele. Produkcja ma 51 tabel publicznych, wszystkie z RLS, 124 polityki i 4 wymagane buckety Storage.
- Zidentyfikowano 65 plików stron i 45 route handlerów API.
- KORIX AI działa lokalnie na regułach i danych magazynowych; repozytorium nie wymaga OpenAI API ani płatnego AI.
- Publiczna strona główna działa na `korix3d.pl`; test przeglądarkowy nie wykrył `Application error`.
- Rozjazd schematu produkcyjnego Supabase został usunięty; wszystkie tabele i kolumny wymagane przez typy aplikacji są obecne.
- Konto właściciela ma rolę `admin`; dashboard i wszystkie 28 statycznych podstron administratora otwierają się bez błędu aplikacji oraz bez utraty sesji.
- Supabase Auth używa `https://korix3d.pl`, ma dwa dokładne redirecty, potwierdzenie e-mail, bezpieczną zmianę hasła, wymaganie bieżącego hasła i minimum 8 znaków.
- Ostatni zweryfikowany commit techniczny (`5a1683a`) ma zielone GitHub CI i jest wdrożony przez Vercel ze statusem `READY`; obsługuje `korix3d.pl`, a `/api/health` po wdrożeniu zwraca `ok`.
- Vercel ma wymagane zmienne Supabase, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` i publiczny klucz podpisu workera. Worker uwierzytelnia się podpisem asymetrycznym, więc wspólny token nie jest wymagany.

## Stan 15 etapów

| Etap | Zakres | Kod/procedury | Dowód zewnętrzny | Status |
| --- | --- | --- | --- | --- |
| 1 | Audyt repozytorium | struktura, trasy, konfiguracja i ryzyka rozpoznane | repo i build sprawdzone | Zakończony |
| 2 | Environment | pełny `.env.example`, walidacja Zod i kontrola CI | wymagane zmienne aplikacji oraz podpis asymetryczny workera skonfigurowane | Zakończony |
| 3 | Supabase | 66 migracji, zgodna historia lokalna/produkcyjna, RLS, indeksy, FK, Storage i testy pgTAP | 66/66 wpisów historii zgodnych; 51 tabel, 124 polityki, 0 tabel bez RLS, 4 buckety; naprawiono dwie produkcyjne blokady zapisu checkoutu | Zakończony |
| 4 | Stripe | checkout sklepu i wyceny, podpisany/idempotentny webhook, zwroty i dokumentacja | pełna płatność sklepu i refund PASS; płatność, anulowanie oraz pełny refund wyceny PASS w Sandbox; magazyn przywrócony idempotentnie | Zakończony (Sandbox) |
| 5 | Vercel | `vercel.json`, Node 20, build i instrukcja rollbacku | produkcyjny redeploy `Ready`, domena i sekrety testowe podłączone | Zakończony |
| 6 | Domena | canonical apex, redirect `www`, HTTPS/HSTS w kodzie | CNAME aktywny w home.pl, certyfikat TLS aktywny, Vercel `Valid Configuration`, redirect 308 potwierdzony | Zakończony |
| 7 | Monitoring | health, chroniony cron, logi bez płatnego dostawcy | `CRON_SECRET` dodany; `/api/health` zwraca 200 | Zakończony |
| 8 | Backup | eksport DB/Storage, obowiązkowe szyfrowanie `age`, checksumy i automatyczne usuwanie jawnych danych | rzeczywisty zewnętrzny eksport wykonany 13.08.2026; zaszyfrowany artefakt 161 835 272 B, SHA-256 PASS, odszyfrowanie PASS i 22/22 obiekty Storage zweryfikowane; pełny restore bazy do izolowanego projektu oczekuje | Częściowo |
| 9 | Worker Creality | timeout, retry, heartbeat, panel produkcji, zadanie Windows, profile, zgodność 3MF i most FreeCAD dla STEP | worker online; 4 rzeczywiste wyceny 3MF; lokalny pipeline STL, OBJ i STEP zaliczony | Zakończony lokalnie |
| 10 | Testy produkcyjne | read-only smoke i macierz 20 obszarów | pełny smoke 12/12 PASS na desktopie i mobile; panel klienta 8/8 i wszystkie statyczne strony admina 29/29 PASS | Częściowo |
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
| `npm test` | PASS | 5 plików, 58/58 testów |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 podatności produkcyjnych; `nanoid` przypięty do 3.3.17 |
| lokalne Playwright E2E | PASS | 18/18 PASS sekwencyjnie na desktopie i mobile po optymalizacji sesji, listy życzeń i AI |
| produkcyjny Playwright smoke | PASS | 12/12 PASS na desktopie i mobile, ponownie wykonany 12.08.2026 w 57,5 s |
| pełne CI GitHub | PASS | commit `badce4e`, przebieg `31597555296`; wszystkie kontrole zakończone powodzeniem; wdrożenie Vercel `dpl_E1tJ2sEVrTYjfjrby2Eu5FpdBGoa` ma status `READY` |
| Lighthouse mobile — SEO / dostępność / dobre praktyki | PASS | 100 / 94 / 100; wynik performance nie jest bramką odbioru, ponieważ lokalny Chrome nie sprząta profilu (`EPERM`) i kolejne pomiary są niestabilne |
| obserwacja produkcji | PASS | ponad 30 min po wdrożeniu; 24/24 health HTTP 200 w dodatkowym oknie 19 min 19 s; mediana 209 ms, średnia 301 ms, p95 609 ms, maksimum 1549 ms; 0 klastrów runtime i 0 odpowiedzi 5xx; heartbeat workera 3 s |
| test zaszyfrowanej kopii | PASS | `age` 1.3.1; szyfrowanie, SHA-256, odszyfrowanie, rozpakowanie, walidacja manifestu i sprzątanie na sztucznych danych |
| Stripe Checkout sklepu | PASS SANDBOX | utworzenie zamówienia, testowa płatność, podpisany webhook, zmniejszenie stanu, pełny refund i idempotentne przywrócenie magazynu potwierdzone |
| Stripe Checkout wyceny 3D | PASS SANDBOX | płatność 46,18 zł, wymagany adres, webhook, powrót do panelu, anulowanie i pełny refund potwierdzone; rezerwacja 28,55 g została wyzerowana, a magazyn wrócił do 1971,450 g dokładnie raz |
| Dopłaty Express/Pilne | PASS DB | nowe wyceny używają odpowiednio 25% i 50% kosztu realizacji przed dostawą i VAT; test Express: 34,40 zł podstawy → 8,60 zł dopłaty; transakcja testowa zakończona `ROLLBACK` |

## Testy działającej witryny

Stan sprawdzony w zalogowanej przeglądarce i testach automatycznych 3–12 sierpnia 2026:

| Obszar | Wynik | Dowód |
| --- | --- | --- |
| Strona główna | PASS | tytuł, jeden H1, brak `Application error` |
| KORIX AI | PASS częściowy | wcześniej potwierdzona odpowiedź na podstawie widocznych filamentów; brak płatnego API |
| `/panel` | PASS | poprawne podsumowanie konta, 2 zamówienia i wartość 230 zł |
| 7 zakładek `/panel/*` | PASS | zamówienia, wyceny, lista życzeń, pliki, powiadomienia, wiadomości i ustawienia bez błędów |
| `/admin` | PASS | poprawny dashboard właściciela z rolą `admin` |
| 29 statycznych `/admin/*` | PASS | pełny zalogowany przebieg 12.08.2026: wszystkie strony bez błędu aplikacji i bez przekierowania do logowania; `/admin/materialy/kolory` prawidłowo kieruje do połączonego `/admin/materialy` |
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

Przed migracjami utworzono schemat `backup_pre_mvp_20260803`: 31 kopii tabel (29 publicznych oraz metadane `storage.buckets` i `storage.objects`), 278 rekordów i około 1,9 MB. Następnie zastosowano w jednej transakcji bazowy komplet 59 migracji, a migrację `20260807130133_restrict_security_definer_execution` zastosowano i zapisano w historii Supabase osobno. Produkcja ma 51 tabel publicznych, 124 polityki, 0 tabel bez RLS i buckety `accounting-reports`, `cms-media`, `product-images`, `quote-files`. Po migracji tylko 1 funkcja `SECURITY DEFINER` jest dostępna dla `anon`, 7 dla `authenticated`, a 19 dla `service_role`; produkcyjny smoke ponownie przeszedł 12/12. Lokalna migracja anulowanych zadań slicera została przemianowana z `20260809130434` na zgodny z produkcją znacznik `20260809130547`; Git potwierdził przeniesienie 100%, bez zmian SQL. Kontrolowany checkout 12.08.2026 ujawnił dwie dalsze rozbieżności starszego schematu: obowiązkowe legacy `product_name`/`price` oraz konflikt nazwy `vat_amount`. Migracje `20260812132323_relax_legacy_store_order_item_columns` i `20260812132838_resolve_store_order_vat_variable` zastosowano w produkcji. Oba przeciążenia funkcji VAT zawierają lokalną dyrektywę rozwiązywania konfliktu; pełne utworzenie zamówienia, pozycji i ruchu magazynowego przeszło w transakcji testowej zakończonej `ROLLBACK`.

13.08.2026, po wykonaniu zaszyfrowanej kopii zewnętrznej i zapisaniu osobnego manifestu historii, uzupełniono 59 brakujących rekordów poleceniem `supabase migration repair --status applied`. Operacja nie uruchomiła ponownie SQL. Dwa lokalne pliki otrzymały produkcyjne znaczniki czasu (`20260812150746` i `20260813073638`); przed zmianą potwierdzono równoważność ich SQL skrótami znormalizowanej zawartości. Kontrola końcowa wykazała 66 rekordów, 66 unikalnych wersji, 0 pustych nazw i 0 pustych zestawów instrukcji. Lokalna i zdalna sekwencja `wersja:nazwa` ma identyczny MD5 `ec91e37d6f6e699965e63c13085d9182`.

Doradcy Supabase po naprawie nie zgłosili nowego błędu krytycznego. Pozostały wcześniejsze zalecenia do osobnego przeglądu: świadomie niedostępne przez RLS tabele wewnętrzne, uprawnienia wybranych funkcji `SECURITY DEFINER`, funkcje zarządzanej integracji Stripe z modyfikowalnym `search_path`, ochrona przed ujawnionymi hasłami, brakujące indeksy kluczy obcych i część nakładających się polityk. Nie zmieniano ich w ramach naprawy samej historii migracji.

## Aktualizacja 21.08.2026 — staging Stripe

- Izolowany staging korzysta z osobnego projektu Supabase i osobnych zmiennych gałęzi Preview w Vercel.
- `/api/health` odpowiada HTTP 200 na produkcji i stagingu.
- Testowa wycena `WYC-20260815-AF32E0` została obliczona przez Creality Print na podstawie rzeczywistego pliku: 174 s, 0,66 g i 50 warstw. Checkout Stripe Sandbox wyniósł 38,20 zł brutto.
- Płatność została rozliczona, następnie wykonano pełny refund 38,20 zł. Staging potwierdza `status=cancelled`, `payment_status=refunded` oraz rezerwację filamentu `0.000 g`.
- Źródłem wcześniejszych odpowiedzi HTTP 401 nie był kod webhooka, lecz ochrona Deployment Protection na podglądzie Vercel. Dla webhooka stagingowego utworzono dedykowane Automation Bypass i zapisano je wyłącznie w konfiguracji usług, bez umieszczania sekretu w repozytorium.
- Po aktualizacji adresu endpointu to samo zdarzenie `charge.refunded` zostało ponowione. Vercel zarejestrował dwie odpowiedzi HTTP 200, a tabela `stripe_webhook_events` zapisała zdarzenie jako `processed` bez `last_error`.
- Ponowne dostarczenie było idempotentne: status zwrotu i zerowa rezerwacja materiału nie uległy zmianie.
- Po zakończeniu odbioru posprzątano staging: usunięto jedno konto testowe, trzy wyceny, dwa zadania slicera, cztery powiadomienia, dwa pliki STL w Storage, 27 jednoznacznie powiązanych wpisów audytu i techniczny wpis webhooka. Kontrola końcowa zwróciła zero pozostałych rekordów testowych, a filament Rosaa PLA Biały ma pełne `1000/1000 g`. Historia płatności i refundu pozostaje wyłącznie w Stripe Sandbox, gdzie zdarzenia finansowe są nieusuwalnym zapisem testowym.
- Ponowna kontrola repozytorium po aktualizacji raportu zakończyła się powodzeniem: lint, TypeScript, 58/58 testów i build 63/63 stron mają status PASS.

## Aktualizacja 22.08.2026 — odbiór końcowy

- Pełny lokalny przebieg kontrolny zaliczył skan sekretów i środowiska, lint, TypeScript, 58/58 testów, wszystkie kontrakty usług oraz produkcyjny build 63/63 stron. Budżet JavaScript obejmuje 90 tras, a lokalny smoke zaliczył 19 stron, 404, oba panele, health i 6 walidacji API.
- Na chronionym stagingu sprawdzono 20 publicznych tras, stronę produktu, pięć stron materiałów, poprawne 404 dla bloga i portfolio, `/api/health` oraz publiczne API filamentów. Nie wykryto `Application error` ani `Internal Server Error`.
- Testowe konto Supabase ujawniło brak `instance_id` w pomocniczym generatorze. Generator został poprawiony i dodany do repozytorium. Po naprawie test Auth + Storage zakończył się wynikiem 4/4 PASS: logowanie, upload STL, pobranie i usunięcie obiektu.
- Zewnętrzna kopia została ponownie sprawdzona: SHA-256 PASS, odszyfrowanie PASS, 4 buckety, 22/22 obiekty Storage i około 143 MB danych obiektowych. Plik `data.sql` ma około 18 MB. Rzeczywisty artefakt z 13.08 nie zawiera jeszcze podziału `pre-data.sql`/`post-data.sql`, dlatego restore będzie wykonany na schemacie utworzonym przez zweryfikowane migracje stagingu.
- Odczyt Stripe Live potwierdził zweryfikowany e-mail i działalność. Aktywny endpoint Live nadal kieruje jednak do starej funkcji Supabase, a nie do `https://korix3d.pl/api/stripe/webhook`. Utworzenie nowego klucza Live, właściwego webhooka i zmiana sekretów Vercel Production oczekują na potwierdzoną operację administracyjną.
- Commit `88742ff` zawierający poprawkę generatora konta ma zielone GitHub CI i wdrożenie Vercel `READY`; alias stagingowy zwraca `{"status":"ok"}`.

## Krytyczne blokady przed produkcją

1. Wykonać pełne próbne odtworzenie danych bazy i 22 obiektów Storage do odizolowanego projektu testowego. Integralność zaszyfrowanego eksportu jest potwierdzona, a schemat stagingu pochodzi z kompletu zweryfikowanych migracji; do wykonania pozostał kontrolowany import danych, porównanie liczników i końcowe sprzątnięcie.
2. Dokończyć zalogowaną część macierzy stagingowej. Płatność Sandbox, refund, idempotentny webhook, publiczne trasy, Auth + Storage i izolacja środowisk mają bezpośredni dowód; formularze tworzące dane oraz bieżący odbiór panelu klienta i administratora wymagają jeszcze potwierdzonego przebiegu i sprzątnięcia.
3. Skonfigurować Stripe Live: nowy nieujawniony klucz serwerowy, osobny webhook Vercel dla sześciu zdarzeń, sekrety wyłącznie w Vercel Production, nowe wdrożenie oraz mała płatność kontrolna z pełnym refundem. Obecny endpoint Live prowadzi do starej funkcji Supabase i nie spełnia kryterium odbioru.

## Kolejność bezpiecznego uruchomienia

1. Vercel `READY` i zielone CI GitHub dla `5a1683a` — wykonane.
2. Wewnętrzna kopia Supabase, migracje, RLS, Storage i health — wykonane.
3. DNS `www`, HTTPS, redirect 308, zewnętrzny szyfrowany backup i oficjalna naprawa historii migracji — wykonane; pozostał pełny restore drill.
4. Staging: pełne testy formularzy, paneli, magazynu, wyceny i Stripe test.
5. Produkcja bez Stripe live: testy logowania, paneli i kontrolowany checkout testowy.
6. Worker Creality Print: utrzymać stały host i heartbeat; lokalne testy STL, STEP, OBJ i 3MF wykonane.
7. Stripe live dopiero po pełnym odbiorze: osobne klucze, osobny webhook, mała płatność i refund.
8. Obserwacja logów, health i kolejki przez minimum 30 minut — wykonana; brak 5xx i klastrów runtime, worker online. Rzeczywiste webhooki Stripe pozostają częścią kontrolowanego testu Checkout.

## Git i wdrożenie

Ostatni zweryfikowany commit techniczny to `5a1683a`. GitHub CI zakończył wszystkie kontrole powodzeniem. Produkcyjne wdrożenie Vercel `dpl_7onEd5te4AS4eyXqQ2bcfsFWfncQ` ma status `READY`, obsługuje aliasy produkcyjne i po wdrożeniu zwraca `ok` z `/api/health`. Commit wzmacnia procedurę szyfrowanej kopii zewnętrznej i jej weryfikację. Wdrożony zestaw zawiera obsługę wieloczęściowych 3MF, izolację ciężkiej konwersji, ograniczenie pamięci, zweryfikowany most FreeCAD dla STEP, obowiązkowo szyfrowany eksport DB/Storage oraz optymalizację publicznego ładowania Supabase. Strona główna jest renderowana serwerowo z pięciominutowym odświeżaniem, anonimowy ruch nie pobiera klienta Supabase ani Zod, a bot pobiera wyłącznie publiczne `greeting` i `enabled` z cache'owanego endpointu — bez ujawniania `system_prompt`. Po wdrożeniu `/api/health` zwrócił HTTP 200.

Dokumentacyjny commit `2e7f3a9` ma zielone CI `31595057599` i wdrożenie `dpl_28HM4nxPnMSATHfrqLnCuJcEYnRM` w stanie `READY`; nie zmienił kodu runtime. Podczas następującej po wdrożeniu obserwacji wykonano 24 kolejne odczyty `/api/health` (24/24 HTTP 200), Vercel nie wykazał klastrów błędów ani odpowiedzi 5xx, a worker `Creality Print 7.1` raportował heartbeat sprzed 3 sekund.

Zmiany opublikowane w `main` obejmują osobne commity dla: bazowego wdrożenia, env, Supabase, Stripe, Vercel, domeny, monitoringu, backupu, workera, testów produkcyjnych, wydajności, SEO, bezpieczeństwa i dokumentacji.

Commit `bb093c9` opublikował poprawkę pełnego refundu sklepu, osobny Checkout wyceny 3D, obsługę anulowania/potwierdzenia/refundu i rozszerzone kontrole. Vercel zgłosił wdrożenie jako udane, `/api/health` zwrócił HTTP 200, a produkcyjna `/wycena` otworzyła się bez błędów aplikacji i konsoli. Migracje są zastosowane w produkcyjnym Supabase. Lokalnie przechodzą lint, TypeScript, 58 testów, kontrola migracji, kontrola Stripe i produkcyjny build 63/63 stron.

PR `#9` (merge `ef04713`) opublikował procentowe dopłaty Express/Pilne oraz zabezpieczony pełny refund wyceny. PR `#10` (merge `8d21fad`) zastąpił natywne `confirm()` czytelnym, dwustopniowym dialogiem. Oba PR-y przeszły komplet kontroli GitHub, Vercel i Netlify. Testowa wycena `WYC-20260813-D7EE4B` została w Stripe Sandbox opłacona, anulowana, ponownie opłacona i w pełni zwrócona. Supabase potwierdził `payment_status=refunded`, `filament_reserved_grams=0.000` oraz stan filamentu `1971.450`; kontrola idempotencji nie zmieniła tych wartości.

## Sekrety i koszty

- Nie zapisano kluczy w repozytorium.
- Klucze wcześniej przekazane w rozmowie są ujawnione i muszą pozostać unieważnione.
- Nie należy przesyłać nowych kluczy na czacie; wpisuje się je bezpośrednio w Supabase, Vercel lub Stripe.
- KORIX AI nie używa OpenAI ani innego płatnego modelu.
- Monitoring nie wymaga płatnego Sentry.
- Płatności Stripe live pozostają wyłączone do pełnego odbioru.

## Kryterium „production ready”

Werdykt można zmienić na **GOTOWE** dopiero, gdy wszystkie blokady powyżej mają bezpośredni dowód: zielony commit w GitHub, zgodny i zbackupowany Supabase, działające oba panele, poprawny DNS, health/monitoring, działający worker, pozytywny Stripe test i pełny odbiór staging/production. Sam zielony build lokalny nie jest wystarczającym dowodem.
