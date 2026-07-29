# Worker Creality Print — produkcja

## Architektura

Creality Print nie działa na Vercel. Worker jest stałym procesem na oddzielnym komputerze Windows z zainstalowanym Creality Print i dostępem wychodzącym HTTPS do `korix3d.pl` oraz Supabase Storage.

Przepływ:

1. klient przesyła prywatny model do `quote-files`;
2. baza tworzy zadanie `pending`;
3. worker uwierzytelnia się długim tokenem i atomowo rezerwuje jedno zadanie;
4. API zwraca podpisany adres ważny 15 minut;
5. Creality Print generuje G-code w katalogu tymczasowym;
6. worker odczytuje czas, masę i liczbę warstw, po czym usuwa pliki lokalne;
7. baza wylicza wycenę z aktualnego cennika.

## Zdalny host Windows

Minimalne wymagania: wspierany Windows 64-bit, Node.js 20 LTS, aktualny Creality Print, szyfrowany dysk, automatyczne aktualizacje bezpieczeństwa i dedykowane konto systemowe bez praw administratora do codziennej pracy.

Skopiuj tylko katalog `services/creality-slicer-worker` oraz jego zależności Node. Utwórz `worker.env` poza repozytorium na podstawie `.env.example`. Wyłącz dziedziczenie NTFS i pozostaw odczyt wyłącznie dla konta workera oraz administratora.

Ustaw `CREALITY_WORKER_HOME`, uruchom PowerShell jako administrator i wykonaj `install-windows-task.ps1`. Zadanie startuje z systemem, nie uruchamia dwóch instancji i ponawia proces minutę po awarii.

## Profile i polecenie Creality

`CREALITY_PRINT_ARGS_JSON` musi pochodzić z testu dokładnie tej wersji Creality Print zainstalowanej na hoście. Worker wymaga znaczników `{input}`, `{outputDir}` i `{infill}`. Profile drukarki, procesu, dyszy i materiału muszą odpowiadać rzeczywistemu sprzętowi.

Przed produkcją wykonaj ten sam referencyjny STL ręcznie i przez worker dla co najmniej 10%, 20%, 50% i 100% wypełnienia. Akceptacja: czas i masa są zgodne z desktopowym Creality Print, G-code nie jest przesyłany do klienta, a katalog tymczasowy jest usuwany.

## Timeout, retry i restart

- próba Creality trwa maksymalnie 18 minut;
- baza odzyskuje porzucone zadanie po 20 minutach;
- błąd przejściowy jest ponawiany maksymalnie trzy razy;
- po błędach połączenia worker stosuje rosnący odstęp do 60 sekund;
- SIGTERM/SIGINT zatrzymuje pobieranie nowych zadań i pozwala dokończyć bieżącą iterację;
- Task Scheduler uruchamia proces po restarcie hosta i po awarii procesu.

Nie zwiększaj timeoutu workera powyżej progu bazy. Długi model należy obsłużyć przez zmianę obu limitów w jednej, przetestowanej migracji i wydaniu.

## Monitoring

Logi są pojedynczymi rekordami JSON typu `korix3d_slicer_worker` i nie zawierają tokenu ani adresu podpisanego. Monitoruj zdarzenia `iteration_failed`, `fatal` i brak `job_completed`.

Worker aktualizuje heartbeat przy każdym odpytywaniu. `/admin/slicer` uznaje go za online przez 90 sekund, a codzienny monitoring produkcyjny zgłasza brak aktywności powyżej 5 minut.

## Procedura awarii

1. Sprawdź stan zadania i ostatni heartbeat w `/admin/slicer`.
2. Sprawdź log zadania Windows oraz rekordy JSON procesu.
3. Potwierdź dostęp HTTPS, ważność tokenu i istnienie modelu w Storage.
4. Sprawdź ręcznie polecenie Creality na pliku technicznym bez danych klienta.
5. Po naprawie uruchom zadanie ponownie przyciskiem w panelu; nie edytuj statusów SQL ręcznie.
6. Jeżeli token mógł wyciec, unieważnij go równocześnie w Vercel i workerze, wykonaj redeploy oraz restart zadania.

## Odbiór produkcyjny

Etap jest gotowy technicznie, gdy walidator repozytorium przechodzi. Odbiór infrastruktury wymaga zdalnego hosta i jednego prawdziwego testu STL, OBJ, STEP i 3MF. Dla każdego formatu sprawdź pobranie, slicing, wagę, czas, wycenę, usunięcie pliku tymczasowego, retry i widoczność heartbeat.
