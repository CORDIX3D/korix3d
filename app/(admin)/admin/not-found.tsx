import { SearchX } from 'lucide-react';
import { PanelEmpty, PanelHeading } from '@/components/customer/panel-state';

export default function AdminNotFound() {
  return (
    <div className="space-y-6">
      <PanelHeading
        title="Nie znaleziono modułu"
        description="Ten adres panelu administratora nie istnieje albo został przeniesiony."
      />
      <PanelEmpty
        icon={SearchX}
        title="Błąd 404"
        description="Sprawdź adres lub wróć do dostępnych modułów panelu."
        actionLabel="Wróć do panelu"
        actionHref="/admin"
      />
    </div>
  );
}
