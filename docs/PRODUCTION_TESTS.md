# Testy produkcyjne KORIX3D

## Zasady bezpieczeństwa

Automatyczne testy uruchamiane przeciwko `https://korix3d.pl` są wyłącznie testami do odczytu. Nie tworzą kont, produktów, zamówień, płatności ani plików. Nie wywołują webhooków Stripe i nie modyfikują danych magazynowych.

Testy tworzące dane należy wykonywać na osobnym środowisku staging z testowym Stripe i dedykowaną bazą Supabase. Produkcyjne płatności wymagają ręcznego odbioru kontrolowaną kwotą oraz późniejszego zwrotu.

Bezpieczny test można uruchomić ręcznie:

```powershell
npm run test:production:smoke
```

Workflow `KORIX3D production smoke` jest uruchamiany ręcznie, aby nie generować niekontrolowanego ruchu.

## Macierz odbioru

| Obszar | Automatyzacja produkcyjna | Pełny odbiór | Stan |
| --- | --- | --- | --- |
| Rejestracja | Nie | staging + testowa skrzynka | Oczekuje |
| Logowanie | Tylko kontrola przekierowania anonimowego | staging i konta testowe | Częściowo |
| Reset hasła | Nie | staging + testowa skrzynka | Oczekuje |
| Dodanie produktu | Nie | konto administratora na staging | Oczekuje |
| Koszyk | Tylko render strony | staging, produkt testowy | Częściowo |
| Kupon | Nie | staging + kupon Stripe test mode | Oczekuje |
| Checkout | Nie | staging + Stripe test mode | Oczekuje |
| Stripe | Nie | staging + test mode | Oczekuje |
| Webhook | Nie | Stripe CLI/test mode | Oczekuje |
| Zamówienie | Nie | staging, pełny przepływ testowy | Oczekuje |
| Magazyn | Nie | staging, administrator | Oczekuje |
| Panel klienta | Kontrola ochrony anonimowej | konto klienta | Błąd danych na produkcji |
| Panel administratora | Kontrola ochrony anonimowej | konto administratora | Brak odpowiedniej roli testowej |
| Upload STL | Tylko kontrola formularza bez wysłania | staging + bezpieczny plik testowy | Częściowo |
| Kalkulator | Tylko stan początkowy | staging + działający worker | Oczekuje |
| Blog | Render strony | staging/produkcja | Częściowo |
| Kontakt | Render strony | staging + testowa skrzynka | Oczekuje |
| Wyszukiwarka | Wyszukiwanie bez zapisu | produkcja | Objęte smoke testem |
| AI | Otwarcie lokalnego asystenta bez płatnego API | produkcja | Odpowiedź magazynowa potwierdzona ręcznie |
| Raporty | Nie | staging, administrator | Oczekuje |

## Stan testów 29 lipca 2026

- Strona główna i najważniejsze strony publiczne renderują się.
- Lokalny asystent KORIX AI odpowiedział danymi zgodnymi z widocznym stanem magazynowym, bez OpenAI API.
- Panel klienta wyświetla błędy pobierania danych w kilku modułach. Najbardziej prawdopodobną przyczyną jest brak aktualnych migracji lub różnica schematu/RLS w produkcyjnym Supabase.
- Konto użyte podczas kontroli nie ma roli administratora; wejście na `/admin` prowadzi do panelu klienta.
- `www.korix3d.pl` nie ma jeszcze działającego DNS, więc test przekierowania ma obecnie wykrywać błąd.
- Lokalny Vitest nie uruchomił się w ograniczonym środowisku z powodu odmowy dostępu narzędzia budującego do katalogu nadrzędnego. To nie był błąd asercji testu.
- Lokalny Playwright osiągał oczekiwane widoki, ale procesy przeglądarki nie kończyły się poprawnie w ograniczonym środowisku. Pełny wynik zapewni CI po wysłaniu commitów.

Pełny odbiór wymaga: aktualizacji produkcyjnego Supabase, kont testowych klient/admin, staging, test mode Stripe, hosta workera oraz działającego DNS `www`.
