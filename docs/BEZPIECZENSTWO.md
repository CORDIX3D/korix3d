# Bezpieczeństwo produkcyjne KORIX3D

## Warstwy ochrony

- Middleware potwierdza użytkownika przez `getUser()` i kontroluje role oraz dostęp do tras administratora.
- API administratora ponownie sprawdza rolę przed utworzeniem osobnego klienta service role.
- RLS jest wymagany dla każdej tabeli, a funkcje uprzywilejowane są ograniczone do `service_role`.
- Mutacje oparte na sesji wymagają własnego `Origin` albo `Sec-Fetch-Site: same-origin/same-site`.
- Publiczne formularze i operacje sklepowe mają limity trwałe w PostgreSQL oraz awaryjny limit procesu.
- Payload JSON, webhook Stripe i pliki wyceny mają jawne limity rozmiaru.
- Pliki STL, STEP, OBJ i 3MF są sprawdzane według rozszerzenia, deklarowanych danych i sygnatury zawartości.
- Webhook Stripe korzysta z surowego body, podpisu, limitu 1 MB i idempotentnego leasingu zdarzeń.

## Nagłówki i przeglądarka

Produkcja wysyła HSTS, CSP, ochronę MIME, blokadę ramek, ograniczenie uprawnień przeglądarki, COOP/CORP, politykę referrer oraz wymuszenie HTTPS dla zasobów. CSP nadal zawiera `unsafe-inline` dla skryptów wymaganych przez aktualny rendering Next.js; nie zawiera `unsafe-eval`. Usunięcie `unsafe-inline` wymaga osobnego wdrożenia nonce i pełnych testów wszystkich tras.

## Sekrety

Sekrety istnieją wyłącznie w ustawieniach Vercel, Supabase, Stripe i hosta workera. Repozytorium zawiera tylko puste nazwy zmiennych. CI skanuje klucze Stripe, OpenAI, Supabase i sekrety webhooków. Klucze wcześniej przekazane na czacie należy traktować jako ujawnione i unieważnić u dostawców.

Service role jest tworzony wyłącznie po stronie serwera przez zwykły `supabase-js`, bez współdzielenia sesji cookies. Nigdy nie wolno umieszczać go w `NEXT_PUBLIC_*` ani logach.

## Zależności

Projekt używa Next.js `15.5.21`, czyli poprawionej wersji Maintenance LTS wskazanej w wydaniu bezpieczeństwa Next.js z 20 lipca 2026. Dependabot co tydzień kontroluje npm i co miesiąc GitHub Actions. CI uruchamia `npm audit --omit=dev --audit-level=high`.

Lokalny `npm audit` 3 sierpnia 2026 nie uzyskał połączenia z endpointem npm w ograniczonym środowisku. Nie jest to wynik „brak podatności”; miarodajnym dowodem będzie zielony krok CI po wysłaniu commitów.

## Reakcja na incydent

1. Wyłącz dotkniętą funkcję lub cofnij wdrożenie w Vercel.
2. Obróć właściwy sekret i usuń poprzedni z Vercel, Supabase, Stripe lub hosta workera.
3. Sprawdź logi Vercel, Supabase Auth/API/Database i Stripe Events bez kopiowania danych osobowych.
4. Zweryfikuj integralność zamówień, płatności, stanów magazynowych i plików.
5. Udokumentuj czas, zakres, podjęte kroki i wymagane zawiadomienia.

Zgłoszenia bezpieczeństwa można wysłać na `kontakt@korix3d.pl`; standardowy plik znajduje się pod `/.well-known/security.txt`.
