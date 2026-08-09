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

Wymagane są: Windows 64-bit, Node.js 20 lub nowszy i Creality Print 7.1.
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

Przy awarii sprawdź najpierw `/admin/slicer`, następnie stan zadania Windows i
log workera. Jeżeli klucz prywatny mógł wyciec, wygeneruj nową parę kluczy,
zaktualizuj klucz publiczny w aplikacji i uruchom ponownie zadanie.

## Odbiór produkcyjny

Przed produkcją zweryfikuj referencyjny model dla PLA i PETG oraz kilku wartości
wypełnienia. Następnie sprawdź STL, OBJ, STEP i 3MF: pobranie, slicing, czas,
wagę, cenę netto/brutto, usunięcie plików tymczasowych, retry i heartbeat.
