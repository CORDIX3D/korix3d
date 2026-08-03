# Wydajność produkcyjna KORIX3D

## Budżety

- Trasy publiczne i panel klienta: maksymalnie 900 000 bajtów niekompresowanego JavaScript według manifestu Next.js.
- Trasy administratora: maksymalnie 1 200 000 bajtów. Wyższy limit uwzględnia wykresy i narzędzia operacyjne.
- Każdy build kończy się kontrolą `npm run check:bundle`; przekroczenie budżetu zatrzymuje CI.

Budżet jest bramką regresji, a nie wynikiem Lighthouse. Po wdrożeniu należy również kontrolować Core Web Vitals na rzeczywistych urządzeniach.

## Zastosowane optymalizacje

- obrazy używają `next/image`, responsywnego `sizes`, AVIF/WebP i pamięci podręcznej;
- asystent KORIX AI jest pobierany dopiero po kliknięciu użytkownika;
- publiczny sklep, blog i FAQ pobierają tylko potrzebne kolumny z Supabase;
- metadane oraz treść stron artykułu i portfolio współdzielą jedno zapytanie w obrębie renderowania;
- kosztowne generowanie plików księgowych działa po stronie serwera;
- dane prywatne, magazynowe, koszykowe i płatnicze pozostają bez cache (`no-store`).

## Cache i dane dynamiczne

Statyczne zasoby są obsługiwane przez CDN Vercel. Dla danych zależnych od użytkownika lub bieżącego stanu magazynowego nie wolno dodawać publicznego cache. Publiczne treści CMS można w przyszłości objąć kontrolowanym `revalidate`, ale dopiero po wdrożeniu niezawodnej invalidacji po zapisie administratora.

## Kontrola po wdrożeniu

1. Uruchom Lighthouse dla strony głównej, sklepu, produktu, wyceny i logowania w trybie mobile.
2. Sprawdź LCP, INP i CLS w Vercel Speed Insights lub bezpłatnym Chrome UX Report.
3. Zbadaj najwolniejsze żądania Supabase i dodaj indeks wyłącznie na podstawie planu zapytania.
4. Porównaj rozmiary tras z ostatnim zielonym buildem.
5. Traktuj regresję LCP/INP lub przekroczenie budżetu JS jako blokadę wdrożenia.

Nie włączono płatnych usług analitycznych ani płatnego AI.
