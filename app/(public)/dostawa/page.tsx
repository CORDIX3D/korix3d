import { InformationPage } from '@/components/layout/information-page';

export const metadata = {
  title: 'Dostawa i płatności | KORIX3D',
  description: 'Informacje o dostawie, odbiorze osobistym i rozliczeniu zamówień w KORIX3D.',
};

export default function DeliveryPage() {
  return (
    <InformationPage
      title="Dostawa i płatności"
      intro="Dostępne sposoby odbioru, wysyłki i rozliczenia zamówień realizowanych przez KORIX3D."
      sections={[
        {
          title: 'Sposoby dostawy',
          content:
            'Zamówienia mogą być odebrane osobiście albo wysłane kurierem lub do paczkomatu, jeżeli dana forma dostawy jest dostępna dla konkretnego zamówienia. Aktualne opcje i koszty są prezentowane w koszyku lub potwierdzane podczas wyceny.',
        },
        {
          title: 'Termin realizacji',
          content:
            'Całkowity czas realizacji obejmuje przygotowanie wyceny, produkcję, ewentualną obróbkę i dostawę. Termin zależy od kolejki produkcyjnej, materiału, rozmiaru modelu, liczby sztuk oraz wybranej metody wysyłki.',
        },
        {
          title: 'Pakowanie wydruków',
          content:
            'Wydruki i produkty zabezpieczamy na czas transportu w sposób dopasowany do ich rozmiaru i delikatności. W przypadku bardzo kruchych lub nietypowych modeli możemy zaproponować indywidualny sposób odbioru lub wysyłki.',
        },
        {
          title: 'Płatności',
          content:
            'Dostępne metody płatności są uzgadniane przed realizacją zamówienia. Płatności internetowe zostaną udostępnione w późniejszym etapie rozwoju sklepu.',
        },
      ]}
    />
  );
}
