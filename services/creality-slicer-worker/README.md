# KORIX3D Creality Print worker

Ten proces uruchamia Creality Print poza Vercel. Pobiera prywatne modele z
krótkotrwałych adresów Supabase, wykonuje slicing i zwraca do KORIX3D czas
druku oraz zużycie filamentu. Nie korzysta z OpenAI.

## Wymagane zmienne

- `KORIX3D_SITE_URL` — produkcyjny adres witryny, bez ukośnika na końcu.
- `CREALITY_SLICER_WORKER_TOKEN` — ten sam długi, losowy sekret co w Vercelu.
- `CREALITY_PRINT_BIN` — ścieżka do pliku wykonywalnego Creality Print.
- `CREALITY_PRINT_ARGS_JSON` — argumenty CLI zapisane jako tablica JSON.
- `CREALITY_PRINTER_PROFILE` — profil konkretnej drukarki.
- `CREALITY_PROCESS_PROFILE` — profil procesu.
- `CREALITY_PRINT_VERSION` — wersja zainstalowanego slicera.

Skopiuj `services/creality-slicer-worker/.env.example` do lokalnego, nieśledzonego pliku środowiskowego. Worker waliduje całą konfigurację przez Zod przed pobraniem pierwszego zadania i kończy się czytelnym błędem, jeżeli adres, token, limity albo tablica argumentów są niepoprawne.

Sekrety procesu nadrzędnego (nazwy kończące się m.in. na `TOKEN`, `SECRET`, `PASSWORD` lub `API_KEY`) nie są przekazywane do procesu Creality Print.

Argumenty mogą zawierać znaczniki: `{input}`, `{outputDir}`, `{infill}`,
`{printerProfile}` i `{processProfile}`. Polecenie jest uruchamiane bez powłoki,
więc wartości pochodzące ze zlecenia nie są interpretowane jako kod.

Dokładny zestaw argumentów trzeba dopasować do zainstalowanej wersji Creality
Print oraz wyeksportowanych profili drukarki, dyszy i filamentu. Przed
uruchomieniem produkcyjnym należy sprawdzić jedno referencyjne STL ręcznie i
porównać wynik z aplikacją desktopową.

Creality Print jest objęty licencją AGPL-3.0. Sposób wdrożenia workera i
udostępniania jego kodu musi zachować wymagania tej licencji.
