import { MessageSquare } from 'lucide-react';
import { UnavailableModule } from '@/components/customer/unavailable-module';

export default function MessagesPage() {
  return (
    <UnavailableModule
      title="Wiadomości"
      description="Kontakt dotyczący wycen i realizacji."
      icon={MessageSquare}
      emptyTitle="Brak wiadomości w panelu"
      emptyDescription="Historia rozmów w panelu nie zawiera jeszcze żadnych wiadomości. Jeśli chcesz dopytać o wycenę lub zamówienie, napisz przez formularz kontaktowy i podaj numer sprawy."
      actionLabel="Napisz do nas"
      actionHref="/kontakt"
    />
  );
}
