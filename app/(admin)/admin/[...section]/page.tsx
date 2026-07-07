import { Construction } from 'lucide-react';
import { PanelEmpty, PanelHeading } from '@/components/customer/panel-state';

const moduleNames: Record<string, string> = {
  analityka: 'Analityka',
  'sklep-zamowienia': 'Zamówienia sklepu',
  wyceny: 'Wyceny',
  produkcja: 'Produkcja',
  produkty: 'Produkty',
  materialy: 'Materiały',
  klienci: 'Klienci',
  wiadomosci: 'Wiadomości',
  kupony: 'Kupony',
  dostawa: 'Dostawa',
  blog: 'Blog',
  faq: 'FAQ',
  portfolio: 'Portfolio',
  pracownicy: 'Pracownicy',
  powiadomienia: 'Powiadomienia',
};

export default function AdminModulePlaceholder({ params }: { params: { section: string[] } }) {
  const key = params.section[0] || '';
  const title = moduleNames[key] || key.replace(/-/g, ' ');
  return <div className="space-y-6"><PanelHeading title={title} description="Moduł administracyjny Korix3D." /><PanelEmpty icon={Construction} title="Moduł jest przygotowywany" description="Ten obszar nie ma jeszcze bezpiecznej implementacji produkcyjnej. Zamiast nieaktywnego formularza lub danych demonstracyjnych pokazujemy jego rzeczywisty stan." actionLabel="Wróć do dashboardu" actionHref="/admin" /></div>;
}
