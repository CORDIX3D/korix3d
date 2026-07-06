'use client';

import Link from 'next/link';
import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin, Printer } from 'lucide-react';

const footerLinks = {
  sklep: [
    { name: 'Filamenty', href: '/sklep?k=f filamenty' },
    { name: 'Akcesoria', href: '/sklep?k=akcesoria' },
    { name: 'Drukarki 3D', href: '/sklep?k=drukarki-3d' },
    { name: 'Gotowe produkty', href: '/sklep?k=gotowe-produkty' },
  ],
  uslugi: [
    { name: 'Wycena wydruku', href: '/wycena' },
    { name: 'Prototypowanie', href: '/uslugi/prototypowanie' },
    { name: 'Części inżynieryjne', href: '/uslugi/czesci-inzynieryjne' },
    { name: 'Małoseryjna produkcja', href: '/uslugi/maloseryjna-produkcja' },
  ],
  firma: [
    { name: 'O nas', href: '/o-nas' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Blog', href: '/blog' },
    { name: 'Kariera', href: '/kariera' },
  ],
  pomoc: [
    { name: 'FAQ', href: '/faq' },
    { name: 'Kontakt', href: '/kontakt' },
    { name: 'Regulamin', href: '/regulamin' },
    { name: 'Polityka prywatności', href: '/polityka-prywatnosci' },
  ],
};

export function PublicFooter() {
  return (
    <footer className="bg-card border-t border-border">
      {/* Main Footer */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center">
                  <Printer className="h-5 w-5 text-white" />
                </div>
              </div>
              <span className="text-xl font-bold text-gradient">KORIX3D</span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Profesjonalny druk 3D, szybkie prototypowanie, części inżynieryjne.
              Od pomysłu do rzeczywistości.
            </p>
            <div className="space-y-2">
              <a href="mailto:kontakt@korix3d.pl" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 text-primary" />
                kontakt@korix3d.pl
              </a>
              <a href="tel:+48123456789" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-4 w-4 text-primary" />
                +48 123 456 789
              </a>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                ul. Przykładowa 1, 00-001 Warszawa
              </div>
            </div>
            {/* Social Links */}
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                <Facebook className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                <Instagram className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </a>
              <a href="#" className="p-2 rounded-lg bg-secondary hover:bg-primary/20 transition-colors">
                <Linkedin className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </a>
            </div>
          </div>

          {/* Links Columns */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Sklep</h4>
            <ul className="space-y-2">
              {footerLinks.sklep.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Usługi</h4>
            <ul className="space-y-2">
              {footerLinks.uslugi.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Firma</h4>
            <ul className="space-y-2">
              {footerLinks.firma.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Pomoc</h4>
            <ul className="space-y-2">
              {footerLinks.pomoc.map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h4 className="font-semibold text-foreground mb-1">Newsletter</h4>
              <p className="text-sm text-muted-foreground">
                Otrzymuj informacje o nowościach i promocjach
              </p>
            </div>
            <form className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                placeholder="Twój email"
                className="flex-1 md:w-64 px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-glow transition-shadow"
              >
                Zapisz się
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} KORIX3D. Wszelkie prawa zastrzeżone.</p>
            <div className="flex flex-wrap gap-4">
              <Link href="/regulamin" className="hover:text-foreground transition-colors">
                Regulamin
              </Link>
              <Link href="/polityka-prywatnosci" className="hover:text-foreground transition-colors">
                Polityka prywatności
              </Link>
              <Link href="/dostawa" className="hover:text-foreground transition-colors">
                Dostawa i płatności
              </Link>
              <Link href="/reklamacje" className="hover:text-foreground transition-colors">
                Reklamacje i zwroty
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
