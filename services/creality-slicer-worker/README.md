# KORIX3D Creality Print worker

Ten proces uruchamia Creality Print poza Netlify. Pobiera prywatne modele z
krĂłtkotrwaĹ‚ych adresĂłw Supabase, wykonuje slicing i zwraca do KORIX3D czas
druku oraz zuĹĽycie filamentu. Nie korzysta z OpenAI.

## Wymagane zmienne

- `KORIX3D_SITE_URL` â€” produkcyjny adres witryny, bez ukoĹ›nika na koĹ„cu.
- `CREALITY_SLICER_WORKER_TOKEN` â€” ten sam dĹ‚ugi, losowy sekret co w Netlify.
- `CREALITY_PRINT_BIN` â€” Ĺ›cieĹĽka do pliku wykonywalnego Creality Print.
- `CREALITY_PRINT_ARGS_JSON` â€” argumenty CLI zapisane jako tablica JSON.
- `CREALITY_PRINTER_PROFILE` â€” profil konkretnej drukarki.
- `CREALITY_PROCESS_PROFILE` â€” profil procesu.
- `CREALITY_PRINT_VERSION` â€” wersja zainstalowanego slicera.

Argumenty mogÄ… zawieraÄ‡ znaczniki: `{input}`, `{outputDir}`, `{infill}`,
`{printerProfile}` i `{processProfile}`. Polecenie jest uruchamiane bez powĹ‚oki,
wiÄ™c wartoĹ›ci pochodzÄ…ce ze zlecenia nie sÄ… interpretowane jako kod.

DokĹ‚adny zestaw argumentĂłw trzeba dopasowaÄ‡ do zainstalowanej wersji Creality
Print oraz wyeksportowanych profili drukarki, dyszy i filamentu. Przed
uruchomieniem produkcyjnym naleĹĽy sprawdziÄ‡ jedno referencyjne STL rĂ™cznie i
porĂłwnaÄ‡ wynik z aplikacjÄ… desktopowÄ….

Creality Print jest objÄ™ty licencjÄ… AGPL-3.0. SposĂłb wdroĹĽenia workera i
udostÄ™pniania jego kodu musi zachowaÄ‡ wymagania tej licencji.
