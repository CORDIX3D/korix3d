'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Mail, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

const footerLinks = {
  sklep: [
    { name: 'Filamenty', href: '/sklep?k=filamenty' },
    { name: 'Akcesoria', href: '/sklep?k=akcesoria' },
    { name: 'Drukarki 3D', href: '/sklep?k=drukarki-3d' },
    { name: 'Gotowe produkty', href: '/sklep?k=gotowe-produkty' },
  ],
  uslugi: [
    { name: 'Wycena wydruku', href: '/wycena' },
    { name: 'Prototypowanie', href: '/wycena?usluga=prototypowanie' },
    { name: 'Części inżynieryjne', href: '/wycena?usluga=czesci-inzynieryjne' },
    { name: 'Małoseryjna produkcja', href: '/wycena?usluga=produkcja-seryjna' },
  ],
  firma: [
    { name: 'O nas', href: '/#o-nas' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Blog', href: '/blog' },
    { name: 'Kariera', href: '/kontakt?temat=kariera' },
  ],
  pomoc: [
    { name: 'FAQ', href: '/faq' },
    { name: 'Kontakt', href: '/kontakt' },
    { name: 'Regulamin', href: '/regulamin' },
    { name: 'Polityka prywatności', href: '/polityka-prywatnosci' },
  ],
};

export function PublicFooter() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  const subscribeNewsletter = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = newsletterEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error('Podaj poprawny adres email');
      return;
    }
    setNewsletterLoading(true);
    const { error } = await supabase.from('newsletter_subscribers').insert([{
      email,
      source: 'footer',
    }]);
    setNewsletterLoading(false);
    if (error && error.code !== '23505') {
      toast.error('Nie udało się zapisać', { description: 'Spróbuj ponownie za chwilę.' });
      return;
    }
    setNewsletterEmail('');
    toast.success(error?.code === '23505' ? 'Ten adres jest już zapisany' : 'Zapisano do newslettera');
  };

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
            <form onSubmit={subscribeNewsletter} className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                autoComplete="email"
                aria-label="Adres email do newslettera"
                required
                disabled={newsletterLoading}
                placeholder="Twój email"
                className="flex-1 md:w-64 px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                disabled={newsletterLoading}
                className="px-4 py-2 bg-gradient-primary text-white rounded-lg font-medium hover:shadow-glow transition-shadow"
              >
                {newsletterLoading ? 'Zapisywanie...' : 'Zapisz się'}
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
                Reklamacje
              </Link>
              <Link href="/zwroty" className="hover:text-foreground transition-colors">
                Zwroty
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
