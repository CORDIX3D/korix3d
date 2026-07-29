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
