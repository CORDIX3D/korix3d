import { MessageSquare } from 'lucide-react';
import { UnavailableModule } from '@/components/customer/unavailable-module';
export default function MessagesPage() { return <UnavailableModule title="Wiadomości" description="Kontakt dotyczący wycen i realizacji." icon={MessageSquare} emptyTitle="Brak wiadomości" emptyDescription="Moduł rozmów w panelu jest przygotowywany. Do tego czasu skorzystaj z formularza kontaktowego — temat zamówienia możesz podać w wiadomości." actionLabel="Napisz do nas" actionHref="/kontakt" />; }
