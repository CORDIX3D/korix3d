# Wdrożenie KORIX3D

## 1. Zasady bezpieczeństwa

- Nie zapisuj kluczy w kodzie, plikach śledzonych przez Git ani wiadomościach.
- Każdy klucz ujawniony wcześniej w rozmowie, zrzucie ekranu lub historii terminala należy unieważnić i wygenerować ponownie.
- Do Netlify wpisuj sekrety bezpośrednio w `Project configuration > Environment variables`.
- Klucz `SUPABASE_SERVICE_ROLE_KEY` i sekret Stripe mogą być używane wyłącznie po stronie serwera.
- Projekt nie wymaga klucza OpenAI. KORIX AI działa lokalnie i nie korzysta z płatnych modeli.

## 2. Wymagane zmienne Netlify

Dodaj poniższe nazwy jako zmienne projektu dostępne dla wdrożenia produkcyjnego:

| Zmienna | Źródło | Zastosowanie |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, ustawienia API projektu | Adres projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, ustawienia API projektu | Publiczne połączenie przeglądarki |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, ustawienia API projektu | Operacje serwerowe i transakcje |
| `NEXT_PUBLIC_SITE_URL` | Docelowa domena HTTPS | Powroty logowania i Stripe |
| `STRIPE_SECRET_KEY` | Stripe, klucze API wybranego trybu | Tworzenie sesji płatności |
| `STRIPE_WEBHOOK_SECRET` | Stripe, szczegóły webhooka | Weryfikacja zdarzeń płatności |
| `CREALITY_SLICER_WORKER_TOKEN` | Wygenerowany losowy sekret | Dostęp zdalnego workera Creality Print |

Zmienne publiczne Supabase są częścią konfiguracji aplikacji. Pozostałe wartości oznacz w Netlify jako zawierające sekret.

## 3. Supabase

1. Utwórz lub wybierz docelowy projekt Supabase.
2. Zastosuj wszystkie migracje z katalogu `supabase/migrations` w kolejności nazw plików.
3. Sprawdź, czy migracje utworzyły zasady RLS, indeksy, funkcje transakcyjne i buckety Storage.
4. W ustawieniach Authentication dodaj docelową domenę jako Site URL.
5. Dodaj do dozwolonych Redirect URLs:
   - `https://TWOJA-DOMENA/auth/callback`
   - `https://TWOJA-DOMENA/reset-password`
6. Utwórz pierwszego użytkownika, a następnie ustaw jego rolę w `profiles` na `admin`.

Nie uruchamiaj checkoutu, dopóki najnowsze migracje sklepu nie zostały zastosowane. Rezerwacja i zwrot stanu magazynowego odbywają się w funkcjach bazodanowych.

## 4. Netlify

1. Połącz witrynę z repozytorium GitHub `CORDIX3D/korix3d` i gałęzią `main`.
2. Ustaw katalog bazowy na katalog projektu, jeśli repozytorium zawiera dodatkowy folder nadrzędny.
3. Konfigurację budowania pozostaw zgodną z `netlify.toml`:
   - komenda: `npm run build`,
   - Node.js: wersja 20,
   - plugin: `@netlify/plugin-nextjs`.
4. Dodaj zmienne środowiskowe z punktu 2.
5. Uruchom nowe wdrożenie po każdej zmianie zmiennych.
6. Po wdrożeniu sprawdź `https://TWOJA-DOMENA/api/health`.

Status `503` oznacza brak wymaganej konfiguracji. Szczegółowy stan usług jest widoczny dla administratora przez `/api/admin/health`.

## 5. Stripe — najpierw tryb testowy

1. W Stripe włącz środowisko testowe i wygeneruj nowy klucz serwerowy.
2. W Netlify ustaw go jako `STRIPE_SECRET_KEY`.
3. W Stripe Workbench otwórz Webhooks i utwórz destination typu Webhook.
4. Ustaw adres endpointu:

   `https://TWOJA-DOMENA/api/stripe/webhook`

5. Wybierz zdarzenia konta:
   - `checkout.session.completed`,
   - `checkout.session.async_payment_succeeded`,
   - `checkout.session.async_payment_failed`,
   - `checkout.session.expired`.
6. Skopiuj nowy signing secret bezpośrednio do Netlify jako `STRIPE_WEBHOOK_SECRET`.
7. Uruchom ponowne wdrożenie.
8. Wykonaj testowe zamówienie i sprawdź, czy:
   - Stripe pokazuje dostarczone zdarzenie,
   - zamówienie zmienia status z `pending` na `paid`,
   - anulowana lub wygasła sesja zwraca stan produktu,
   - opłacone zamówienie pojawia się w panelu klienta i administratora.

Kod celowo nie uruchomi płatności, jeśli brakuje sekretu webhooka. Chroni to klienta przed zapłatą, której system nie potrafiłby przypisać do zamówienia.

## 6. Worker Creality Print

Sama aplikacja internetowa nie uruchamia Creality Print. Zdalny worker musi działać na osobnej maszynie z zainstalowanym slicerem i używać tego samego `CREALITY_SLICER_WORKER_TOKEN` co Netlify.

Po uruchomieniu workera sprawdź w `/admin/slicer`:

- ostatni heartbeat,
- wersję slicera,
- profile drukarki i procesu,
- kolejkę, błędy i zakończone analizy.

Bez aktywnego workera formularz może przyjąć plik, ale dokładny czas i masa nie zostaną automatycznie wyliczone przez Creality Print.

## 7. Kontrola końcowa

Przed przełączeniem Stripe na tryb live:

1. Uruchom lint, kontrolę typów, skan sekretów i build.
2. Sprawdź rejestrację, logowanie i reset hasła.
3. Sprawdź dodawanie produktu, materiału i filamentu w panelu administratora.
4. Sprawdź formularz wyceny z plikiem STL, STEP, OBJ i 3MF.
5. Sprawdź zakup jako gość i jako zalogowany klient.
6. Sprawdź dostawę, adres wysyłki oraz fakturę dla osoby i firmy.
7. Sprawdź anulowanie płatności, wygaśnięcie sesji i ponowne dostarczenie webhooka.
8. Dopiero po udanym teście utwórz osobny webhook i osobne klucze dla trybu live.

Dokumentacja: [zmienne Netlify](https://docs.netlify.com/build/environment-variables/get-started/), [webhooki Stripe](https://docs.stripe.com/workbench/event-destinations).
