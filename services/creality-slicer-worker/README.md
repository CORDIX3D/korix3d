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

Skopiuj `.env.example` do lokalnego, nieśledzonego pliku `worker.env`. Worker
waliduje zmienne i istnienie wszystkich plików przed pobraniem zadania.

## Działanie

Worker sam buduje zweryfikowane argumenty CLI Creality Print 7.1. Rodzaj
materiału wybiera profil z `CREALITY_FILAMENT_PROFILES_JSON`, a wypełnienie
przekazuje przez `--sparse-infill-density`. Po uruchomieniu czeka na kompletny,
stabilny G-code, również gdy aplikacja Windows wcześniej zamknie proces
startowy. Polecenie nie korzysta z powłoki, a sekrety nie są przekazywane do
Creality Print.

Nieudane zadanie jest ponawiane maksymalnie trzy razy. Próba kończy się przed
20-minutowym progiem odzyskania zadania przez bazę. Szczegóły instalacji,
monitoringu i odbioru opisuje `docs/WORKER_PRODUCTION.md`.

Creality Print jest objęty AGPL-3.0; sposób wdrożenia musi zachować warunki tej
licencji.
