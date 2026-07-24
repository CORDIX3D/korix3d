import { Bell } from 'lucide-react';
import { UnavailableModule } from '@/components/customer/unavailable-module';

export const metadata = {
  title: 'Powiadomienia | Panel klienta KORIX3D',
  description: 'Powiadomienia o koncie, wycenach i realizacji zamówień KORIX3D.',
};

export default function NotificationsPage() {
  return (
    <UnavailableModule
      title="Powiadomienia"
      description="Aktualizacje dotyczące Twojego konta i realizacji."
      icon={Bell}
      emptyTitle="Wszystko przeczytane"
      emptyDescription="Nie masz nowych powiadomień. Najważniejsze zmiany statusów sprawdzisz również na liście zamówień."
      actionLabel="Sprawdź zamówienia"
      actionHref="/panel/zamowienia"
    />
  );
}
