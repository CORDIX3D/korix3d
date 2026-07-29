# Domena korix3d.pl — konfiguracja produkcyjna

## Stan zweryfikowany 29 lipca 2026

- `korix3d.pl` ma rekord A `76.76.21.21`, wskazujący sieć Vercel.
- Strona pod `https://korix3d.pl` odpowiada i jest indeksowana.
- `www.korix3d.pl` nie ma obecnie rekordu DNS (NXDOMAIN).
- Domena kanoniczna w aplikacji to `https://korix3d.pl`.
- Kod zawiera stałe przekierowanie `www` → domena bez `www`, które zadziała po dodaniu subdomeny do DNS i Vercel.

## Konfiguracja DNS i Vercel

W panelu operatora DNS:

1. Pozostaw rekord apex `A korix3d.pl → 76.76.21.21`, o ile Vercel nadal wskazuje tę wartość w konfiguracji projektu.
2. Dodaj `CNAME www → cname.vercel-dns.com` albo dokładną wartość wyświetloną przez Vercel dla tego projektu.
3. Nie dodawaj jednocześnie rekordu A i CNAME dla `www`.
4. Zachowaj rekordy MX/TXT poczty. Nie zmieniaj ich podczas podłączania strony.

W `Vercel → Project → Settings → Domains`:

1. Dodaj `korix3d.pl` jako domenę główną.
2. Dodaj `www.korix3d.pl`.
3. Ustaw `www.korix3d.pl` jako przekierowanie 308 do `korix3d.pl` albo pozostaw przekierowanie kodowe jako drugą warstwę ochrony.
4. Poczekaj na status `Valid Configuration` i wystawienie certyfikatu dla obu nazw.

## HTTPS, SSL i HSTS

Vercel automatycznie przekierowuje HTTP do HTTPS po poprawnym przypisaniu domeny i wystawia certyfikat. Aplikacja wysyła:

`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

Nie zgłaszaj domeny do listy HSTS preload przed poprawnym uruchomieniem HTTPS również dla `www` i wszystkich używanych subdomen. Dyrektywa `includeSubDomains` oznacza, że każda przyszła subdomena musi działać przez HTTPS.

## Kontrola po propagacji DNS

Sprawdź kolejno:

- `https://korix3d.pl` → HTTP 200;
- `http://korix3d.pl` → przekierowanie do HTTPS;
- `https://www.korix3d.pl/dowolna-sciezka?x=1` → stałe przekierowanie do tej samej ścieżki na `https://korix3d.pl`;
- certyfikat obejmuje `korix3d.pl` i `www.korix3d.pl`;
- `https://korix3d.pl/robots.txt` → HTTP 200 i link do sitemap;
- `https://korix3d.pl/sitemap.xml` → HTTP 200 i adresy tylko z domeny kanonicznej;
- `https://korix3d.pl/site.webmanifest` → HTTP 200;
- favicony nie zwracają 404.

## Pliki domenowe w aplikacji

- canonical i baza metadanych: `app/layout.tsx`;
- przekierowanie `www`: `next.config.js`;
- robots: `app/robots.ts`;
- sitemap: `app/sitemap.ts`;
- manifest: `public/site.webmanifest`;
- favicon i ikony: katalog `public`.

Po zmianie domeny zaktualizuj również Site URL i Redirect URLs w Supabase Auth, `NEXT_PUBLIC_SITE_URL` w Vercel oraz success/cancel URL Stripe. Dla `korix3d.pl` te wartości są już spójne w repozytorium.
