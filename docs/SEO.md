# SEO produkcyjne KORIX3D

## Zakres techniczny

- kanoniczna domena `https://korix3d.pl` i canonical dla tras publicznych;
- dynamiczna mapa witryny obejmująca produkty, artykuły, materiały i portfolio;
- robots.txt blokujący panele, uwierzytelnianie, API, koszyk i checkout;
- Open Graph, Twitter Card, ikony i manifest w języku polskim;
- schema.org: Organization, LocalBusiness, Product, Offer, Article, FAQPage i BreadcrumbList;
- bezpieczna serializacja JSON-LD chroniąca przed wstrzyknięciem znacznika `script`.

## Google Search Console

1. Dodaj usługę domenową `korix3d.pl` w Google Search Console.
2. Zweryfikuj domenę rekordem DNS TXT albo skopiuj token HTML do zmiennej Vercel `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.
3. Po nowym wdrożeniu zgłoś `https://korix3d.pl/sitemap.xml`.
4. Sprawdź indeksowanie i dane rozszerzone po propagacji.

## Bing Webmaster Tools

1. Dodaj `https://korix3d.pl` w Bing Webmaster Tools.
2. Skopiuj wartość `msvalidate.01` do `NEXT_PUBLIC_BING_SITE_VERIFICATION` w Vercel.
3. Po wdrożeniu zgłoś tę samą mapę witryny.

Tokeny weryfikacyjne są publiczne, lecz nadal należy ustawiać je w Vercel, a nie wpisywać na stałe do repozytorium.

## Odbiór po wdrożeniu

Sprawdź `/robots.txt`, `/sitemap.xml`, `/site.webmanifest`, canonical i JSON-LD w kodzie wyrenderowanej strony. Następnie użyj Rich Results Test dla produktu, artykułu, FAQ i breadcrumbs. Nie publikuj fikcyjnego adresu firmy; LocalBusiness świadomie zawiera tylko potwierdzone dane kontaktowe i obszar obsługi Polska.
