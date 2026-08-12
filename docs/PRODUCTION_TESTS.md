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
| Upload STL/OBJ/STEP/3MF | Kontrola formularza bez zapisu | lokalny pipeline zaliczony; pełny przepływ na staging | Częściowo |
| Kalkulator | Stan początkowy i działający worker | pełny przepływ na staging | Częściowo |
| Blog | Render strony | staging/produkcja | Częściowo |
| Kontakt | Render strony | staging + testowa skrzynka | Oczekuje |
| Wyszukiwarka | Wyszukiwanie bez zapisu | produkcja | Objęte smoke testem |
| AI | Otwarcie lokalnego asystenta bez płatnego API | produkcja | Odpowiedź magazynowa potwierdzona ręcznie |
| Raporty | Nie | staging, administrator | Oczekuje |

## Stan testów 12 sierpnia 2026

- Strona główna i najważniejsze strony publiczne renderują się.
- Lokalny asystent KORIX AI odpowiedział danymi zgodnymi z widocznym stanem magazynowym, bez OpenAI API.
- Panel klienta przeszedł odbiór 8/8, a 16 kluczowych widoków administratora otwiera się bez błędu danych.
- Produkcyjny Supabase ma aktualne wymagane tabele, kolumny, RLS, polityki i Storage.
- `www.korix3d.pl` ma aktywny DNS, TLS i przekierowanie 308 do domeny głównej.
- Vitest przechodzi 57/57, a produkcyjny smoke przechodzi 12/12 na desktopie i mobile.
- Worker jest uruchamiany automatycznie jako zadanie Windows, ma heartbeat, retry i lokalny panel.
- Rzeczywiste cięcie STL i OBJ dało 174 s, 0,66 g i 50 warstw dla kostki 10 mm.
- Rzeczywisty STEP został lokalnie przekonwertowany przez FreeCAD i pocięty przez Creality: 9 s, 0,01 g i 10 warstw.

Pełny odbiór nadal wymaga: osobnego stagingu, pełnych przepływów tworzących dane,
Stripe test mode oraz próby zewnętrznego odtworzenia backupu.
