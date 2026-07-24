import { InformationPage } from '@/components/layout/information-page';

export const metadata = {
  title: 'Regulamin | KORIX3D',
  description: 'Zasady korzystania z serwisu KORIX3D, składania zamówień oraz realizacji usług druku 3D.',
};

export default function TermsPage() {
  return (
    <InformationPage
      title="Regulamin"
      intro="Zasady korzystania z serwisu, składania zamówień oraz realizacji usług druku 3D w KORIX3D."
      sections={[
        {
          title: 'Zakres usług',
          content:
            'KORIX3D świadczy usługi druku 3D, przygotowania wycen, realizacji wydruków na podstawie plików klienta oraz sprzedaży produktów prezentowanych w sklepie. Zakres, cena i termin wykonania usługi są potwierdzane przed rozpoczęciem realizacji.',
        },
        {
          title: 'Składanie zamówień',
          content:
            'Zamówienie lub zapytanie wyceny można złożyć przez formularz w serwisie, panel klienta albo kontakt mailowy. Klient powinien podać prawdziwe dane kontaktowe oraz komplet informacji potrzebnych do przygotowania wyceny, w tym wybrany materiał, kolor, ilość i pliki modelu.',
        },
        {
          title: 'Pliki i prawa do modeli',
          content:
            'Klient odpowiada za posiadanie praw do przesłanych plików, modeli i materiałów. KORIX3D może odmówić realizacji zlecenia, jeżeli plik jest uszkodzony, narusza prawa osób trzecich lub nie pozwala na bezpieczne wykonanie wydruku.',
        },
        {
          title: 'Wycena i realizacja',
          content:
            'Realizacja rozpoczyna się po zaakceptowaniu wyceny oraz ustaleniu wymaganych parametrów. Termin realizacji zależy od kolejki produkcyjnej, dostępności materiałów, złożoności modelu i wybranej metody dostawy.',
        },
        {
          title: 'Kontakt',
          content:
            'Pytania dotyczące regulaminu można kierować na adres kontakt@korix3d.pl. W korespondencji dotyczącej zamówienia warto podać numer zlecenia lub numer zamówienia.',
        },
      ]}
    />
  );
}
