import { InformationPage } from '@/components/layout/information-page';

export const metadata = {
  title: 'Zwroty | KORIX3D',
  description: 'Zasady zwrotów produktów standardowych i wydruków wykonywanych na indywidualne zamówienie.',
};

export default function ReturnsPage() {
  return (
    <InformationPage
      title="Zwroty"
      intro="Zasady odstąpienia od umowy i zwrotu produktów zakupionych lub wykonanych przez KORIX3D."
      sections={[
        {
          title: 'Produkty standardowe',
          content:
            'W przypadku produktów niepersonalizowanych skontaktuj się z nami przed odesłaniem zamówienia. Produkt powinien być kompletny, nieuszkodzony i odpowiednio zabezpieczony na czas transportu.',
        },
        {
          title: 'Wydruki wykonywane na zamówienie',
          content:
            'Prawo odstąpienia może nie przysługiwać w przypadku produktów wykonywanych według indywidualnej specyfikacji klienta, w tym wydruków 3D realizowanych na podstawie przesłanego pliku, wybranego materiału, koloru lub innych parametrów.',
        },
        {
          title: 'Koszt odesłania',
          content:
            'Koszt odesłania produktu zależy od przyczyny zwrotu oraz uzgodnień z obsługą KORIX3D. Nie odsyłaj produktu bez wcześniejszego kontaktu, aby uniknąć problemów z identyfikacją przesyłki.',
        },
        {
          title: 'Kontakt',
          content:
            'Aby rozpocząć procedurę zwrotu, napisz na kontakt@korix3d.pl i podaj numer zamówienia, dane kontaktowe oraz powód zwrotu.',
        },
      ]}
    />
  );
}
