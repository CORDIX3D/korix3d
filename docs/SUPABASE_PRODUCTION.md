# Supabase — konfiguracja produkcyjna KORIX3D

## Kontrakt zapisany w repozytorium

- 58 migracji w `supabase/migrations`, stosowanych wyłącznie w kolejności wersji.
- RLS dla 44 tabel i testy ról w `supabase/tests/database/rls.test.sql`.
- 3 buckety: publiczny `product-images` oraz prywatne `quote-files` i `accounting-reports`.
- Limity i dozwolone typy plików zapisane w migracjach, nie ustawiane ręcznie w aplikacji.
- Konfiguracja lokalna/Auth i wymóg JWT Edge Functions w `supabase/config.toml`.
- Edge Functions wymagają dodatkowo roli `admin` i odrzucają obcy origin.

Polecenie `npm run check:supabase` kontroluje migracje, RLS, redirecty Auth i zabezpieczenia funkcji bez łączenia z produkcją.

## Ustawienia wymagane w panelu Supabase

W projekcie produkcyjnym otwórz `Authentication > URL Configuration`:

- Site URL: `https://korix3d.pl`
- Redirect URLs:
  - `https://korix3d.pl/auth/callback`
  - `https://korix3d.pl/reset-password`

Nie dodawaj ogólnego wildcardu dla wszystkich domen Vercel. Staging powinien mieć osobny projekt Supabase i dokładny adres wdrożenia Preview.

W `Authentication > Providers > Email`:

- pozostaw logowanie email/hasło włączone,
- wymagaj potwierdzenia email,
- włącz ochronę zmiany hasła,
- ustaw minimalną długość hasła co najmniej 8 znaków,
- przed produkcją skonfiguruj własnego dostawcę SMTP, nadawcę `KORIX3D` i domenę z SPF, DKIM oraz DMARC,
- wykonaj realny test potwierdzenia konta i odzyskania hasła.

Wbudowana usługa testowa Supabase nie powinna być traktowana jako produkcyjny kanał email.

## Klucze aplikacji

Z `Project Settings > API` pobierz wyłącznie:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`,
- publishable/anon key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
- secret/service_role key → `SUPABASE_SERVICE_ROLE_KEY`.

Pierwsze dwie wartości są konfiguracją klienta. Klucz secret/service_role jest sekretem serwera i musi istnieć tylko w Vercel Production/Preview. Token konta rozpoczynający się od `sbp_` nie jest kluczem aplikacji.

## Kontrolowane wdrożenie migracji

Workflow `.github/workflows/deploy-supabase-production.yml` wykonuje migracje i wdraża Edge Functions wyłącznie ręcznie oraz po zatwierdzeniu środowiska GitHub `production`.

W `GitHub > Settings > Environments` utwórz `production`, dodaj wymaganego reviewera i skonfiguruj:

- variable `SUPABASE_PROJECT_REF`,
- secret `SUPABASE_ACCESS_TOKEN` o minimalnym zakresie,
- secret `SUPABASE_DB_PASSWORD`.

Przed uruchomieniem:

1. potwierdź świeży backup bazy i Storage,
2. wykonaj te same migracje oraz pgTAP na stagingu,
3. w Actions wybierz `Deploy Supabase Production`,
4. wpisz dokładnie `deploy-production`,
5. zatwierdź job środowiska `production`,
6. po wdrożeniu porównaj listę migracji i sprawdź `/api/admin/health`.

Workflow nie zapisuje kopii danych jako artefaktu GitHub, ponieważ zawierałaby dane klientów.

## Kontrola zdalna

Po zalogowaniu do panelu należy potwierdzić:

- wszystkie 58 wersji w historii migracji,
- brak ostrzeżeń Security Advisor dotyczących RLS i `SECURITY DEFINER`,
- 3 buckety z właściwą widocznością i limitami,
- włączone backupy odpowiednie do przyjętego RPO,
- poprawne indeksy i brak długotrwałych zapytań w Query Performance,
- brak publicznego dostępu do `monthly-report` oraz `ai-analysis`,
- status email/SMTP i poprawne redirecty.

Bez tej kontroli nie oznaczaj Supabase jako gotowego produkcyjnie.
