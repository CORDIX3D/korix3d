# Worker Creality Print — produkcja

## Architektura

1. Klient wysyła prywatny model do Supabase Storage.
2. Baza tworzy zadanie oczekujące.
3. Worker podpisuje żądanie prywatnym kluczem i rezerwuje jedno zadanie.
4. API zwraca podpisany adres pliku ważny 15 minut.
5. Creality Print generuje G-code w katalogu tymczasowym.
6. Worker odczytuje czas, wagę i liczbę warstw oraz usuwa pliki lokalne.
7. Baza oblicza aktualną cenę netto i brutto z ustawień administratora.

Creality Print nie działa na Vercel. Worker musi działać stale na komputerze
Windows z dostępem wychodzącym HTTPS do `korix3d.pl` i Supabase Storage.

## Zdalny host Windows

Wymagane są: Windows 64-bit, Node.js 20 lub nowszy, Creality Print 7.1 oraz
FreeCAD 1.1 lub nowszy do lokalnej obsługi STEP/STP.
Utwórz `worker.env` na podstawie `.env.example`, wyłącz dziedziczenie praw NTFS
i pozostaw odczyt tylko kontu workera oraz administratorowi. Ustaw
`CREALITY_WORKER_HOME`, uruchom PowerShell jako administrator i wykonaj
`install-windows-task.ps1`. Zadanie startuje z systemem, ignoruje równoległą
drugą instancję i uruchamia się ponownie po awarii.

## Profile Creality

Worker używa zweryfikowanego interfejsu CLI Creality Print 7.1:
`--load-settings`, `--load-filaments`, `--sparse-infill-density`, `--slice 0`
i `--outputdir`. Ścieżki profilu maszyny i procesu są ustawiane osobno, a mapa
`CREALITY_FILAMENT_PROFILES_JSON` dobiera profil do materiału ze zlecenia.
Brak profilu kończy zadanie czytelnym błędem zamiast użycia złego materiału.

Dla plików 3MF worker zawsze używa szybkiej ścieżki zgodności. Geometria z
modelu jest lokalnie konwertowana do binarnego STL i cięta w Creality Print
z niezmienionym profilem drukarki, materiału i wypełnienia. Pomija to znane
zawieszanie bezpośredniego trybu CLI Creality Print 7.1. Wynik zawiera
ostrzeżenie o przygotowaniu geometrii; proces nie korzysta z usług AI ani
zewnętrznego API.

Dla STEP/STP worker uruchamia `FreeCADCmd.exe` bez powłoki i przekazuje ścieżki
wejścia/wyjścia w izolowanym środowisku procesu. FreeCAD eksportuje siatkę STL,
worker sprawdza jej rozmiar, a dopiero potem Creality Print wykonuje właściwe
cięcie. `STEP_CONVERTER_TIMEOUT_MS` nie może przekroczyć limitu całego zadania.
Brak FreeCAD zatrzymuje worker przed pobieraniem zleceń, zamiast zużywać próby
klientów.

Test lokalny na pliku technicznym:

```powershell
node --env-file=worker.env verify-local.mjs
```

## Timeout, retry i restart

- maksymalny czas próby jest krótszy niż 20-minutowy próg bazy;
- błąd przejściowy jest ponawiany najwyżej trzy razy;
- kolejne błędy połączenia zwiększają odstęp maksymalnie do 60 sekund;
- worker czeka na stabilny plik G-code, nawet gdy proces startowy Windows zamknie się wcześniej;
- SIGTERM i SIGINT zatrzymują pobieranie nowych zadań;
- logi JSON nie zawierają tokenu ani podpisanego adresu pliku;
- `/admin/slicer` pokazuje heartbeat, profil i stan kolejki.
- podczas aktywnego cięcia osobny heartbeat jest wysyłany co 30 sekund, więc
  status online nie zależy od czasu potrzebnego na wygenerowanie G-code;
- przygotowanie wieloczęściowego 3MF działa w osobnym wątku i nie blokuje
  lokalnego panelu; limit czasu konwersji jest krótszy od limitu całego zadania;
- konwersja STEP/STP ma osobny timeout, walidację wyjściowego STL i czytelny błąd;

Przy awarii sprawdź najpierw `/admin/slicer`, następnie stan zadania Windows i
log workera. Jeżeli klucz prywatny mógł wyciec, wygeneruj nową parę kluczy,
zaktualizuj klucz publiczny w aplikacji i uruchom ponownie zadanie.

## Odbiór produkcyjny

Przed produkcją zweryfikuj referencyjny model dla PLA i PETG oraz kilku wartości
wypełnienia. Następnie sprawdź STL, OBJ, STEP i 3MF: pobranie, slicing, czas,
wagę, cenę netto/brutto, usunięcie plików tymczasowych, retry i heartbeat.
12 sierpnia 2026 lokalny pipeline zakończył rzeczywiste testy STL, OBJ i STEP;
pełny przepływ formularz → Storage → worker pozostaje częścią odbioru stagingu.
