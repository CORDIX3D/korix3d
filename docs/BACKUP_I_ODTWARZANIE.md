# Backup i odtwarzanie KORIX3D

## Cele operacyjne

- Docelowy RPO: maksymalnie 24 godziny utraconych zmian.
- Docelowy RTO: przywrócenie podstawowej sprzedaży w ciągu 4 godzin.
- Te wartości są celami procesu. Trzeba potwierdzić, że wybrany plan Supabase i organizacja pracy rzeczywiście je spełniają.

## Co podlega kopii

1. Baza PostgreSQL: użytkownicy aplikacji, sklep, magazyn, zamówienia, wyceny, cennik i historia zmian.
2. Prywatne i publiczne obiekty Supabase Storage: zdjęcia produktów oraz pliki modeli. Kopia bazy przechowuje metadane, ale nie zastępuje kopii samych obiektów.
3. Kod, migracje i dokumentacja: repozytorium GitHub.
4. Konfiguracja: lista nazw zmiennych i ustawień, bez zapisywania wartości sekretów w repozytorium.

## Harmonogram

- Codziennie: sprawdź status zarządzanych kopii Supabase i ostatnie udane wdrożenie.
- Przed każdą migracją produkcyjną: wykonaj lub potwierdź świeżą kopię logiczną oraz kopię zmienianych bucketów.
- Co tydzień: wyeksportuj zaszyfrowaną kopię logiczną do oddzielnej lokalizacji i sprawdź jej sumę kontrolną.
- Co kwartał: przeprowadź próbne odtworzenie do odizolowanego projektu testowego.

Retencję i dostępność point-in-time recovery należy dobrać w panelu Supabase odpowiednio do planu. Instrukcja dostawcy: [Database Backups](https://supabase.com/docs/guides/platform/backups).

## Bezpieczne wykonanie kopii

1. Ogranicz dostęp do osoby odpowiedzialnej za produkcję.
2. Potwierdź identyfikator projektu i środowisko — nigdy nie zakładaj, że aktywny projekt jest produkcyjny.
3. Korzystaj z narzędzi Supabase/PostgreSQL zgodnych z wersją serwera.
4. Zapisuj kopię w szyfrowanej lokalizacji poza projektem produkcyjnym.
5. Nie umieszczaj zrzutów bazy, plików klientów ani sekretów w GitHubie.
6. Zapisz czas kopii, zakres, wykonawcę, sumę kontrolną i wynik w rejestrze operacyjnym.

### Automatyczny eksport kontrolowany

Repozytorium zawiera `scripts/backup/backup-production.ps1`. Skrypt:

- wykonuje logiczny eksport ról, schematu, danych i historii migracji przez Supabase CLI;
- pobiera wszystkie obiekty Storage wraz z konfiguracją bucketów;
- kopiuje bezsekretowy kontrakt środowiska i konfiguracje wdrożenia;
- liczy SHA-256 każdego obiektu i od razu uruchamia weryfikację.
- pakuje wynik, szyfruje go publicznym kluczem `age` i zapisuje sumę SHA-256 zaszyfrowanego pliku;
- usuwa wszystkie tymczasowe jawne pliki zarówno po sukcesie, jak i po błędzie.

Uruchamiaj go na zaufanej maszynie z Node.js, bezpłatnym `age` i Supabase CLI (lub `npx`). Wartości `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` oraz `SUPABASE_SERVICE_ROLE_KEY` ustaw tylko w bieżącej sesji terminala. `KORIX3D_BACKUP_AGE_RECIPIENT` zawiera wyłącznie publiczny klucz odbiorcy `age1...`. Prywatny klucz przechowuj poza repozytorium i poza katalogiem kopii. `KORIX3D_BACKUP_DIR` musi wskazywać katalog poza repozytorium. Skrypt celowo odmawia zapisu kopii wewnątrz projektu i pozostawia wyłącznie pliki `.tar.age` oraz `.sha256`.

Po każdym eksporcie uruchom `scripts/backup/verify-encrypted-backup.ps1 <plik.tar.age>` z ustawioną zmienną `KORIX3D_BACKUP_AGE_IDENTITY`, wskazującą prywatny klucz. Test sprawdza sumę zaszyfrowanego pliku, odszyfrowuje go do losowego katalogu tymczasowego, weryfikuje bazę i wszystkie obiekty Storage, a następnie usuwa jawne dane testowe.

Nie uruchamiaj tego eksportu w GitHub Actions ani Vercel: artefakt zawiera dane osobowe i prywatne modele klientów. Harmonogram tygodniowy ustaw w systemowym Harmonogramie zadań na dedykowanej maszynie backupowej, a wynik kopiuj do drugiej zaszyfrowanej lokalizacji.

## Backup konfiguracji i sekretów

Kod, migracje, Edge Functions, `vercel.json`, `supabase/config.toml` i listę nazw zmiennych chroni GitHub oraz eksport skryptu. Wartości sekretów przechowuj osobno w menedżerze haseł z MFA i kontrolą dostępu.

Raz w miesiącu porównaj nazwy wpisów w menedżerze z `.env.example`, ale nie eksportuj jawnych wartości do katalogu projektu. Dla każdego sekretu zapisz właściciela, usługę, środowisko, datę ostatniej rotacji i procedurę unieważnienia. Kopia sekretów musi być zaszyfrowana innym kluczem niż dostęp do głównej stacji roboczej.

## Odtwarzanie

1. Wstrzymaj nowe płatności i operacje administracyjne, jeśli dalsze zapisy mogłyby pogorszyć stan.
2. Utwórz nowy, odizolowany projekt Supabase. Nie nadpisuj od razu produkcji.
3. Odtwórz kopię PostgreSQL, a następnie obiekty Storage.
4. Uruchom brakujące migracje w kolejności nazw przez narzędzie migracyjne Supabase.
5. Wykonaj `npm run check:db`, `npm run check:rls` oraz testy pgTAP na tym środowisku.
6. Sprawdź liczbę zamówień, pozycje zamówień, rezerwacje magazynowe, profile, wyceny i dostępność plików.
7. Skontroluj na stagingu logowanie, zakup testowy, webhook oraz dostęp klienta wyłącznie do własnych danych.
8. Dopiero po akceptacji skieruj aplikację do odtworzonego projektu i obserwuj logi.

Kopii produkcyjnej nie wolno używać w środowisku programistycznym bez anonimizacji danych osobowych.

## Migracje i istniejące dane

Migracje są przeznaczone do jednokrotnego wykonania w rosnącej kolejności. W repozytorium występują historyczne migracje usuwające wyłącznie określone dane niezgodne z docelowym modelem, m.in. płatne ustawienia AI, osierocone rekordy i duplikaty przed dodaniem ograniczeń unikalności. Z tego powodu:

- przed pierwszym uruchomieniem całej historii na istniejącej bazie wykonaj próbę na jej kopii,
- nie uruchamiaj ręcznie już zastosowanych plików,
- nie edytuj historycznej migracji po jej wdrożeniu; poprawkę dodaj jako nowy plik,
- migracje destrukcyjne wymagają osobnej akceptacji i zweryfikowanej kopii,
- cofnięcie aplikacji nie oznacza automatycznego cofnięcia schematu; preferuj zgodną wstecznie migrację naprawczą.

## Próba odtworzenia — kryterium zaliczenia

- baza uruchamia się bez błędów,
- wszystkie migracje mają oczekiwany status,
- RLS nie ujawnia danych innego klienta,
- zdjęcia i modele wskazane w bazie istnieją w Storage,
- suma stanów i rezerwacji zgadza się z zamówieniami,
- testowy checkout i idempotentny webhook przechodzą,
- zmierzony czas odtworzenia mieści się w przyjętym RTO.

## Test odtworzenia krok po kroku

Test wykonuj kwartalnie wyłącznie do nowego projektu Supabase bez ruchu klientów:

1. Uruchom `scripts/backup/verify-encrypted-backup.ps1 <plik.tar.age>` i zachowaj wynik. Nie rozpakowuj kopii ręcznie do stałego katalogu.
2. Utwórz pusty projekt testowy w tym samym lub zgodnym regionie.
3. Zastosuj kolejno `roles.sql`, `pre-data.sql`, `data.sql` i `post-data.sql` przez `psql --single-transaction --variable ON_ERROR_STOP=1`. Taki podział tworzy klucze obce dopiero po danych i obsługuje również tabele z cyklicznymi zależnościami. `schema.sql` pozostaje pełną kopią kontrolną schematu; nie uruchamiaj go dodatkowo po `pre-data.sql`. Przy błędach ról zarządzanych postępuj zgodnie z aktualną instrukcją Supabase.
4. Odtwórz `history_schema.sql` i `history_data.sql`, aby zachować historię migracji.
5. Utwórz buckety zgodnie z migracjami, a następnie wgraj obiekty z katalogu `storage` zachowując bucket i pełną ścieżkę z manifestu.
6. Wdróż Edge Functions z repozytorium i ustaw nowe, testowe sekrety; nigdy nie kopiuj live Stripe do testu.
7. Porównaj liczbę obiektów i SHA-256 z `storage-manifest.json` oraz kluczowe liczby rekordów w tabelach.
8. Uruchom testy RLS, logowanie, odczyt prywatnego pliku właściciela, zakup Stripe test i jedno zadanie slicera.
9. Zapisz rzeczywisty RPO/RTO, wszystkie ręczne poprawki i wynik testu. Usuń projekt testowy dopiero po zatwierdzeniu raportu i zgodnie z zasadami retencji danych.

Do testu logowania można wygenerować jednorazowe konto poleceniem
`node scripts/backup/prepare-staging-test-account.mjs <katalog-poza-repozytorium>`.
Skrypt zapisuje losowe dane logowania wyłącznie we wskazanym katalogu zewnętrznym
oraz przygotowuje SQL zgodny z aktualnym kontraktem Supabase Auth. Plików tych nie
wolno dodawać do Git ani używać w projekcie produkcyjnym. Po odbiorze usuń konto,
powiązane zamówienie i katalog z danymi logowania.

Zarządzane kopie bazy Supabase nie zastępują osobnego backupu obiektów Storage. PITR może wiązać się z dodatkowym kosztem i nie należy go włączać bez decyzji właściciela; przy docelowym RPO 24 godziny podstawą są codzienne kopie dostawcy i cotygodniowy zweryfikowany eksport poza usługę.
