# Architektura KORIX3D

## Zakres systemu

KORIX3D to aplikacja Next.js 15 (App Router) wdrażana na Vercelu. Warstwa widoku i trasy serwerowe znajdują się w jednym repozytorium. Supabase zapewnia PostgreSQL, uwierzytelnianie i Storage. Stripe obsługuje płatności, a osobny worker z Creality Print analizuje modele 3D.

## Główne elementy

| Element | Odpowiedzialność | Granica zaufania |
| --- | --- | --- |
| Przeglądarka | interfejs publiczny, klienta i administratora | wszystkie dane wejściowe są niezaufane |
| Next.js na Vercelu | walidacja, autoryzacja, checkout, webhooki i API | sekrety są dostępne wyłącznie po stronie serwera |
| Supabase Auth | sesje i tożsamość użytkownika | rola jest weryfikowana po stronie serwera i przez RLS |
| PostgreSQL + RLS | dane sklepu, wycen, kont i audytu | klient ma dostęp tylko do dozwolonych wierszy |
| Supabase Storage | zdjęcia i modele do wycen | typ, rozmiar, właściciel i ścieżka są kontrolowane |
| Stripe | pobranie płatności | cena i pozycje powstają z danych serwerowych, nie z przeglądarki |
| Worker Creality Print | dokładny czas i masa wydruku | dostęp wymaga osobnego tokenu, zadania mają retry i heartbeat |
| KORIX AI | lokalne odpowiedzi na podstawie danych sklepu | brak OpenAI i brak kosztowego API |

## Krytyczne przepływy

### Zakup

1. Klient wybiera produkt i ilość.
2. Serwer ponownie pobiera produkt, cenę i stan z bazy.
3. Funkcja PostgreSQL blokuje rekordy w stałej kolejności i rezerwuje stan w jednej transakcji.
4. Serwer tworzy sesję Stripe wyłącznie dla zweryfikowanego zamówienia.
5. Podpisany webhook Stripe finalizuje płatność. Identyfikator zdarzenia zapewnia idempotencję.
6. Wygaśnięcie lub nieudana płatność zwalnia rezerwację dokładnie raz.

### Wycena modelu 3D

1. Serwer przyjmuje wyłącznie STL, STEP, OBJ lub 3MF w dozwolonym limicie.
2. Plik trafia do prywatnego bucketu, a metadane do zamówienia klienta.
3. Zadanie analizy pobiera uwierzytelniony worker Creality Print.
4. Worker zwraca czas i masę; serwer wylicza cenę z aktualnego cennika i materiału.
5. Klient widzi czas, masę oraz ceny netto i brutto, bez wewnętrznych składowych kosztu.

### Panel administratora

Sesja jest sprawdzana po stronie serwera. Mutacje wymagają poprawnego pochodzenia żądania, właściwej roli i przechodzą przez RLS lub kontrolowanego klienta serwisowego. Ważne zmiany trafiają do historii edycji wraz z wykonawcą.

## Dane i migracje

Źródłem prawdy schematu jest `supabase/migrations`. Pliki mają unikalny, rosnący znacznik czasu i są stosowane jeden raz w kolejności nazw przez mechanizm migracji Supabase. Nie należy kopiować pojedynczych fragmentów SQL do produkcji ani ponownie wykonywać już zapisanych migracji.

Statyczne kontrole `npm run check:db` i `npm run check:rls` sprawdzają kolejność, podstawową spójność oraz wymagane zabezpieczenia. Pełne zachowanie polityk sprawdzają testy pgTAP na lokalnym lub stagingowym Supabase.

## Monitoring

Aplikacja zapisuje strukturalne, ograniczone do minimum logi błędów w logach platformy. Błędy przeglądarki trafiają do `/api/monitoring/client-error` bez treści formularzy, sekretów i danych płatniczych. `/api/health` ujawnia tylko ogólny stan; szczegóły konfiguracji są dostępne administratorowi w `/api/admin/health`.
