# Obsługa produkcji KORIX3D

## Środowiska

| Środowisko | Dane | Integracje | Przeznaczenie |
| --- | --- | --- | --- |
| lokalne | dane techniczne, bez danych klientów | Stripe test, lokalny Supabase | rozwój i testy |
| staging / Vercel Preview | odizolowany projekt testowy | osobne klucze Stripe test i token workera | akceptacja migracji i wydania |
| produkcja | dane klientów | Stripe live dopiero po akceptacji | ruch klientów |

Nie wolno współdzielić `SUPABASE_SERVICE_ROLE_KEY`, sekretu webhooka ani tokenu workera pomiędzy stagingiem i produkcją.

## Checklista przed produkcją

- [ ] GitHub Actions dla docelowego commita ma zielony status.
- [ ] Na kopii stagingowej zastosowano wszystkie migracje w kolejności.
- [ ] Jest świeża, zweryfikowana kopia bazy i obiektów Storage.
- [ ] Uzupełniono zmienne Vercel osobno dla Preview i Production.
- [ ] Supabase Site URL i Redirect URLs wskazują właściwe domeny.
- [ ] Testy RLS pgTAP przeszły na lokalnym lub stagingowym Supabase.
- [ ] Stripe działa w trybie testowym, webhook jest podpisany i idempotentny.
- [ ] Sprawdzono zakup gościa i klienta, wygaśnięcie sesji oraz zwrot stanu.
- [ ] Worker Creality Print wysyła heartbeat i poprawnie analizuje każdy dozwolony format.
- [ ] Formularze, upload, panel klienta i panel administratora przeszły test akceptacyjny.
- [ ] `/api/health` odpowiada poprawnie, a administrator widzi `/api/admin/health`.
- [ ] Ustalono osobę odpowiedzialną za wdrożenie, obserwację oraz ewentualny rollback.

## Wdrożenie

1. Zatrzymaj zmiany schematu i potwierdź kopię.
2. Zastosuj migracje na stagingu i wykonaj testy krytyczne.
3. Połącz zatwierdzony commit z `main`; pipeline musi przejść w całości.
4. Zastosuj te same migracje na produkcji przez Supabase CLI lub kontrolowany proces platformy.
5. Wdróż dokładnie ten commit na Vercelu.
6. Sprawdź health, logowanie, publiczny sklep i małe zamówienie testowe.
7. Przez co najmniej 30 minut obserwuj błędy, webhooki, rezerwacje stanu i kolejkę slicera.

## Cofnięcie wdrożenia

Jeśli błąd dotyczy aplikacji, skieruj ruch do ostatniego poprawnego wdrożenia Vercel. Oficjalna procedura: [Rolling back a production deployment](https://vercel.com/docs/deployments/rollback-production-deployment).

Nie cofaj bazy przez ręczne usuwanie kolumn lub tabel. Jeśli nowa wersja wykonała migrację, upewnij się, że poprzednia aplikacja jest z nią zgodna. W przeciwnym razie wdróż poprawkę naprzód albo przełącz cały system na wcześniej zweryfikowane, odtworzone środowisko.

Po rollbacku powtórz test health, logowania, sklepu, checkoutu, webhooka i magazynu. Zapisz przyczynę oraz identyfikatory wdrożeń w raporcie incydentu.

## Monitoring i codzienna kontrola

- sprawdź `/api/health` oraz dostęp administratora do `/api/admin/health`,
- przeglądaj w logach Vercela strukturalne zdarzenia `korix3d_error`,
- sprawdź w Stripe niedostarczone webhooki i płatności bez zgodnego zamówienia,
- sprawdź kolejkę slicera, heartbeat workera i zadania po wyczerpaniu retry,
- sprawdź błędy uploadu oraz nietypowy wzrost odrzuconych żądań,
- nie kopiuj do zgłoszeń tokenów, treści plików, danych kart ani pełnych danych klienta.

Wbudowany monitoring nie wymaga płatnego dostawcy ani dodatkowego klucza. W przyszłości można podłączyć zewnętrzny system, ale dopiero po decyzji dotyczącej kosztów i prywatności.

## Reagowanie na awarię

1. **Ogranicz skutki:** wyłącz tylko uszkodzoną funkcję lub wstrzymaj checkout, jeśli zagrożone są płatności albo magazyn.
2. **Ustal zakres:** zapisz czas, wersję, środowisko, trasę i identyfikator korelacyjny; nie zbieraj sekretów.
3. **Zabezpiecz dane:** nie uruchamiaj naprawczego SQL przed kopią i próbą na stagingu.
4. **Przywróć usługę:** rollback aplikacji albo zgodna migracja naprawcza.
5. **Zweryfikuj:** wykonaj scenariusz, który wywołał błąd, oraz testy obszarów zależnych.
6. **Udokumentuj:** przyczyna, wpływ, działania, czas przywrócenia i zabezpieczenie przed powtórką.

### Priorytety

- P1: błędne płatności, wyciek danych, utrata danych lub sprzedaż ponad stan — reakcja natychmiastowa.
- P2: niedostępny checkout, logowanie, panel lub wycena — naprawa w bieżącym dniu.
- P3: pojedyncza funkcja pomocnicza lub błąd prezentacji — zaplanowana poprawka.

## Incydent sekretu

1. Unieważnij ujawniony klucz u dostawcy; samo usunięcie z kodu nie wystarcza.
2. Wygeneruj nowy klucz o najmniejszym potrzebnym zakresie.
3. Zmień go w Vercelu i właściwej usłudze, a potem wykonaj redeploy.
4. Sprawdź logi użycia od czasu ujawnienia i odrzuć aktywne sesje, jeśli mogły zostać naruszone.
5. Uruchom `npm run check:secrets` i potwierdź zielony pipeline.

Zasady Stripe: [API keys best practices](https://docs.stripe.com/keys-best-practices). Procedura kopii znajduje się w [Backup i odtwarzanie](BACKUP_I_ODTWARZANIE.md), a pełna konfiguracja w [Wdrożenie](WDROZENIE.md).
