# KORIX3D Creality Print worker

Proces uruchamia Creality Print na stałym komputerze Windows. Pobiera prywatny
model z krótkotrwałego adresu Supabase, wykonuje slicing, zwraca czas druku,
wagę filamentu i liczbę warstw, a następnie usuwa pliki tymczasowe. Nie używa
OpenAI ani żadnej innej płatnej usługi AI.

## Konfiguracja

- `KORIX3D_SITE_URL` — produkcyjny adres witryny.
- `CREALITY_SLICER_WORKER_PRIVATE_KEY_PATH` — lokalna ścieżka do prywatnego klucza podpisu.
- `CREALITY_PRINT_BIN` — pełna ścieżka do `CrealityPrint.exe`.
- `CREALITY_MACHINE_PROFILE_PATH` — pełna ścieżka do profilu drukarki JSON.
- `CREALITY_PROCESS_PROFILE_PATH` — pełna ścieżka do profilu procesu JSON.
- `CREALITY_FILAMENT_PROFILES_JSON` — mapa materiałów na profile, np. PLA i PETG.
- `CREALITY_PRINTER_PROFILE` i `CREALITY_PROCESS_PROFILE` — czytelne nazwy widoczne w panelu.
- `CREALITY_PRINT_VERSION` — wersja zainstalowanego slicera.
- `SLICER_WORKER_ID` — stały identyfikator tego komputera.
- `SLICER_DASHBOARD_PORT` — port lokalnego panelu, domyślnie `4317`.

Skopiuj `.env.example` do lokalnego, nieśledzonego pliku `worker.env`. Worker
waliduje zmienne i istnienie wszystkich plików przed pobraniem zadania.

## Aplikacja produkcyjna

Po uruchomieniu workera lokalny panel jest dostępny wyłącznie na tym komputerze
pod adresem `http://127.0.0.1:4317`. Pokazuje rzeczywisty stan procesu,
kalkulacje, czas i masę wydruków oraz zamówienia i płatności pobierane z
KORIX3D podpisanym żądaniem. Panel online `/admin/produkcja` działa również jako
instalowalna aplikacja PWA na iOS i innych urządzeniach.

Przed pobraniem pierwszego zadania worker wykonuje test uruchomienia Creality
Print. Jeżeli Windows App Control blokuje plik wykonywalny, worker nie pobiera
zleceń i ponawia sam test co minutę. Dzięki temu błąd instalacji nie zużywa prób
zadań klientów.

## Działanie

Worker sam buduje zweryfikowane argumenty CLI Creality Print 7.1. Rodzaj
materiału wybiera profil z `CREALITY_FILAMENT_PROFILES_JSON`, a wypełnienie
przekazuje przez `--sparse-infill-density`. Po uruchomieniu czeka na kompletny,
stabilny G-code, również gdy aplikacja Windows wcześniej zamknie proces
startowy. Polecenie nie korzysta z powłoki, a sekrety nie są przekazywane do
Creality Print.

Każdy plik 3MF jest od razu przygotowywany jako neutralna siatka STL, a następnie
analizowany w Creality Print z tym samym profilem drukarki, filamentu oraz
wypełnienia. Pomija to długie zawieszenie znane z bezpośredniego trybu CLI
Creality Print 7.1. Informacja o tej ścieżce jest zapisywana w ostrzeżeniach
wyniku. Konwersja odbywa się lokalnie i nie korzysta z płatnego API.

Nieudane zadanie jest ponawiane maksymalnie trzy razy. Próba kończy się przed
20-minutowym progiem odzyskania zadania przez bazę. Szczegóły instalacji,
monitoringu i odbioru opisuje `docs/WORKER_PRODUCTION.md`.

Podczas długiego cięcia worker wysyła osobny heartbeat co 30 sekund. Panel
administratora nie oznacza dzięki temu działającego workera jako offline, gdy
Creality Print nadal analizuje duży model.

Przygotowanie dużego lub wieloczęściowego 3MF działa w odizolowanym wątku,
więc nie blokuje panelu ani heartbeat. Konwerter zapisuje STL bez przechowywania
drugiej pełnej kopii siatki w pamięci. Pomiar rzeczywistego modelu 701 428
trójkątów zakończył przygotowanie geometrii w około 11 sekund.

Creality Print jest objęty AGPL-3.0; sposób wdrożenia musi zachować warunki tej
licencji.
