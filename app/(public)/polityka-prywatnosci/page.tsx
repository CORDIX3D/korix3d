import { InformationPage } from '@/components/layout/information-page';

export const metadata = {
  title: 'Polityka prywatności',
  description: 'Informacje o przetwarzaniu danych osobowych w serwisie KORIX3D.',
  alternates: { canonical: '/polityka-prywatnosci' },
};

export default function PrivacyPage() {
  return (
    <InformationPage
      title="Polityka prywatności"
      intro="Informacje o tym, jakie dane przetwarzamy, w jakim celu i jak możesz się z nami skontaktować."
      sections={[
        {
          title: 'Administrator danych',
          content:
            'Administratorem danych przekazywanych przez formularze serwisu jest KORIX3D. W sprawach dotyczących danych osobowych możesz napisać na kontakt@korix3d.pl.',
        },
        {
          title: 'Zakres danych',
          content:
            'Przetwarzamy dane podane dobrowolnie w formularzach, takie jak imię i nazwisko, adres email, numer telefonu, dane adresowe, treść wiadomości, informacje o zamówieniu oraz pliki przesłane do wyceny druku 3D.',
        },
        {
          title: 'Cel przetwarzania',
          content:
            'Dane są wykorzystywane do obsługi konta klienta, przygotowania wycen, realizacji zamówień, kontaktu z klientem, obsługi reklamacji i zwrotów, prowadzenia rozliczeń oraz realizacji obowiązków prawnych.',
        },
        {
          title: 'Okres przechowywania',
          content:
            'Dane przechowujemy przez czas potrzebny do obsługi sprawy, realizacji zamówienia i spełnienia obowiązków księgowych lub prawnych. Dane z formularza kontaktowego mogą być przechowywane przez czas potrzebny do zakończenia korespondencji.',
        },
        {
          title: 'Twoje prawa',
          content:
            'Możesz zażądać dostępu do danych, ich poprawienia, usunięcia, ograniczenia przetwarzania lub przeniesienia danych, jeżeli przepisy dają taką możliwość. W tym celu skontaktuj się z nami mailowo.',
        },
      ]}
    />
  );
}
