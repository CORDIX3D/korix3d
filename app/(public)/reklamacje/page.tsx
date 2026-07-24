import { InformationPage } from '@/components/layout/information-page';

export const metadata = {
  title: 'Reklamacje | KORIX3D',
  description: 'Jak zgłosić problem z produktem, wydrukiem 3D lub realizacją zamówienia w KORIX3D.',
};

export default function ComplaintsPage() {
  return (
    <InformationPage
      title="Reklamacje"
      intro="Jak zgłosić problem z produktem, wykonanym wydrukiem lub realizacją zamówienia."
      sections={[
        {
          title: 'Zgłoszenie reklamacji',
          content:
            'Wyślij wiadomość na kontakt@korix3d.pl, podając numer zamówienia, opis problemu, datę odbioru lub dostawy oraz zdjęcia produktu. Im dokładniejszy opis, tym szybciej możemy ocenić sprawę.',
        },
        {
          title: 'Weryfikacja zgłoszenia',
          content:
            'Po otrzymaniu kompletu informacji potwierdzimy przyjęcie zgłoszenia i przeanalizujemy problem. W przypadku wydruków 3D możemy poprosić o dodatkowe zdjęcia, pomiary albo informacje o sposobie użytkowania elementu.',
        },
        {
          title: 'Możliwe rozwiązania',
          content:
            'W zależności od sytuacji możemy zaproponować poprawkę, ponowne wykonanie elementu, częściowy zwrot kosztów albo inne właściwe rozwiązanie uzgodnione z klientem.',
        },
        {
          title: 'Transport',
          content:
            'Nie odsyłaj produktu bez wcześniejszego uzgodnienia sposobu i adresu zwrotu. Pozwala to uniknąć zagubienia przesyłki oraz ułatwia połączenie paczki ze zgłoszeniem.',
        },
      ]}
    />
  );
}
