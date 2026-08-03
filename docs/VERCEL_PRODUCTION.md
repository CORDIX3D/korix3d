# Vercel — konfiguracja produkcyjna

## Projekt i źródło wdrożenia

- Repozytorium: `CORDIX3D/korix3d`.
- Production Branch: `main`.
- Framework Preset: Next.js.
- Root Directory: puste (katalog główny repozytorium).
- Install Command: `npm ci`.
- Build Command: `npm run build`.
- Node.js: główna wersja 20, zgodnie z `package.json` i `.nvmrc`.

`vercel.json` przechowuje wyłącznie bezpieczne ustawienia budowania. Identyfikator projektu, organizacji i token Vercel nie są zapisywane w repozytorium.

## Środowiska

| Ustawienie | Production | Preview | Development |
| --- | --- | --- | --- |
| Gałąź / źródło | `main` | pull request | komputer deweloperski |
| Supabase | projekt produkcyjny | osobny projekt staging | lokalny lub staging |
| Stripe | klucze live dopiero po odbiorze | wyłącznie klucze test | wyłącznie klucze test |
| `NEXT_PUBLIC_SITE_URL` | `https://korix3d.pl` | adres konkretnego preview lub staging | `http://localhost:3000` |
| Worker | produkcyjny token | osobny token testowy | token lokalny |

Nie należy podłączać Vercel Preview do produkcyjnego service role Supabase ani do kluczy Stripe live. Jeśli nie ma oddzielnego stagingu, pozostaw w Preview wyłączone sekrety operacji płatniczych i administracyjnych.

## Zmienne środowiskowe

W `Project Settings → Environment Variables` dodaj osiem wymaganych zmiennych z `.env.example` oraz, po uzyskaniu tokenów, dwie opcjonalne zmienne weryfikacji SEO. Wartości Production i Preview muszą być odseparowane. Po każdej zmianie wykonaj nowe wdrożenie — istniejące deploymenty zachowują poprzedni zestaw wartości.

Sekrety serwerowe:

- nie mogą mieć prefiksu `NEXT_PUBLIC_`;
- nie mogą trafić do GitHub Actions, jeśli dany workflow ich nie potrzebuje;
- powinny zostać ponownie wygenerowane po każdym ujawnieniu;
- powinny być dostępne tylko członkom zespołu, którzy obsługują produkcję.

## Functions i Edge Runtime

Trasy API pozostają w domyślnym środowisku Node.js. Jest to świadomy wybór: integracje Stripe, Supabase Admin, generowanie plików Excel i obsługa webhooków korzystają z bibliotek serwerowych, dla których Edge Runtime nie daje korzyści współmiernej do ryzyka.

Proces Creality Print nie działa jako Vercel Function. Jest osobną, stale działającą usługą i komunikuje się z krótkimi endpointami kolejki.

Region funkcji należy ustawić w panelu Vercel dopiero po potwierdzeniu regionu produkcyjnego Supabase. Obie usługi powinny być możliwie blisko siebie. Nie wpisujemy regionu na ślepo do repozytorium.

## Cache, ISR i dane prywatne

- Panel klienta, panel administratora, checkout, webhooki i API operacyjne używają `no-store` lub dynamicznego renderowania.
- Odpowiedzi autoryzacyjne z middleware mają `Cache-Control: no-store`.
- Zasoby Next.js z hashem są buforowane automatycznie przez CDN Vercel.
- Obrazy przechodzą przez optymalizację Next.js i mają minimalny TTL 24 godziny.
- ISR nie jest wymuszany na stronach zależnych od aktualnego stanu magazynu. Nie wolno buforować ceny lub dostępności w sposób, który pozwoli złożyć zamówienie na nieaktualnych danych; finalna kontrola i tak odbywa się transakcyjnie w bazie.

## Nagłówki i HTTPS

`next.config.js` ustawia CSP, HSTS, ochronę przed osadzaniem w ramce, ograniczenia uprawnień i ochronę MIME. TLS i przekierowanie HTTP→HTTPS zapewnia Vercel po prawidłowym podłączeniu domeny.

## Pierwsze wdrożenie

1. Zaimportuj repozytorium GitHub do Vercel i potwierdź ustawienia projektu z pierwszej sekcji.
2. Dodaj zmienne Production bez ujawniania ich w rozmowie.
3. Ustaw produkcyjną gałąź `main` i włącz automatyczne wdrożenia po zmianie tej gałęzi.
4. Podłącz domeny zgodnie z `DOMENA_PRODUCTION.md`.
5. Wykonaj deployment i sprawdź log kompilacji.
6. Otwórz `/api/health`; oczekiwany wynik to HTTP 200 i `status: ok`.
7. Zaloguj administratora i otwórz `/api/admin/health`, aby sprawdzić konfigurację usług bez ujawniania wartości sekretów.

## Rollback

W przypadku błędu wybierz ostatnie poprawne wdrożenie w `Deployments` i użyj `Promote to Production` / `Rollback`. Cofnięcie aplikacji nie cofa migracji bazy. Jeżeli nowe wdrożenie wymagało niekompatybilnej migracji, stosuj procedurę odtworzenia opisaną w `BACKUP_I_ODTWARZANIE.md`.

Po rollbacku sprawdź `/api/health`, logowanie, sklep i jedno kontrolowane wywołanie webhooka testowego. Nie usuwaj wadliwego deploymentu przed zabezpieczeniem logów diagnostycznych.
