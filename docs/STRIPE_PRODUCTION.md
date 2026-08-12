# Stripe — konfiguracja produkcyjna

## Model płatności

- Waluta sklepu: **PLN**.
- Kwoty w Supabase są cenami **brutto**, zawierającymi polski VAT.
- Stripe Checkout otrzymuje dynamiczne `price_data`; katalog produktów i cen Stripe nie jest źródłem prawdy i nie wymaga ręcznego powielania asortymentu.
- `automatic_tax` jest celowo wyłączony, aby Stripe nie doliczył podatku drugi raz. Zmiana tego ustawienia wymaga wcześniej zmiany modelu cen i konsultacji księgowej.
- Klient podaje wymagany adres dostawy i adres rozliczeniowy w aplikacji przed rozpoczęciem płatności.

## Zmienne produkcyjne

W Vercel, wyłącznie dla środowiska **Production**, ustaw:

- `STRIPE_SECRET_KEY` — nowy klucz tajny trybu live (`sk_live_...`), z ograniczeniami odpowiednimi dla integracji;
- `STRIPE_WEBHOOK_SECRET` — sekret podpisujący oddzielnego produkcyjnego endpointu (`whsec_...`).

Nie zapisuj wartości w repozytorium, wiadomości, zrzucie ekranu ani pliku `.env.example`. Klucze ujawnione wcześniej należy unieważnić w Stripe i zastąpić nowymi.

## Produkcyjny webhook

Utwórz w Stripe Workbench endpoint:

`https://korix3d.pl/api/stripe/webhook`

Subskrybowane zdarzenia:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Stan zweryfikowany 12.08.2026 w Stripe Sandbox: endpoint `KORIX3D Vercel test` jest aktywny, wskazuje na powyższy adres i nasłuchuje wszystkich 6 zdarzeń. Pełny test Checkout i zwrotu pozostaje do wykonania na kontrolowanym produkcie testowym; nie wolno w tym celu aktywować prawdziwego produktu bez jawnej decyzji właściciela sklepu.

Endpoint weryfikuje podpis na surowym body, ogranicza rozmiar żądania, odrzuca nieznane zdarzenia i rejestruje identyfikator zdarzenia w bazie. Ponowne dostarczenie tego samego eventu jest bezpieczne.

## Przejście TEST → LIVE

1. Unieważnij wszystkie klucze, które pojawiły się w rozmowach lub logach.
2. Włącz konto Stripe do obsługi rzeczywistych płatności i uzupełnij dane firmy oraz rachunek wypłat.
3. W trybie live utwórz nowy ograniczony klucz dla aplikacji lub nowy klucz tajny.
4. Utwórz osobny webhook trybu live dla podanego wyżej adresu.
5. Dodaj oba sekrety do Vercel Production; nie dodawaj ich do Preview ani Development bez potrzeby.
6. Wykonaj nowe wdrożenie Vercel, ponieważ zmiana sekretów nie aktualizuje już zbudowanego wdrożenia.
7. Złóż jedno kontrolowane zamówienie o małej wartości i sprawdź kolejno: płatność, status `paid`, pojedyncze przetworzenie webhooka i widoczność zamówienia w panelu klienta oraz administratora.
8. W Stripe potwierdź, że webhook otrzymał odpowiedź HTTP 2xx. W Vercel sprawdź brak błędów funkcji.
9. Wykonaj pełny zwrot testowego zamówienia i potwierdź status `refunded`.

## Reakcja na błędy

- Błąd podpisu webhooka: sprawdź, czy sekret pochodzi dokładnie z produkcyjnego endpointu, a nie z CLI lub trybu testowego.
- Odpowiedź 500: Stripe ponowi dostarczenie; nie twórz ręcznie drugiego zamówienia.
- Niezgodna kwota lub sesja: aplikacja ignoruje zdarzenie i zapisuje diagnostykę bez danych karty.
- Wygasła sesja: zamówienie jest anulowane, a zarezerwowany stan magazynowy zwracany.
- Nieudana pojedyncza próba karty nie zwalnia zapasu, ponieważ klient może ponowić próbę w tej samej sesji.

## Dane kart

KORIX3D nie przyjmuje ani nie zapisuje numerów kart. Dane płatnicze są wpisywane wyłącznie na stronie Stripe Checkout. W logach aplikacji nie wolno zapisywać sekretów, podpisów webhooka ani pełnych danych klienta.
