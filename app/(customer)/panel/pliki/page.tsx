import { Download } from 'lucide-react';
import { UnavailableModule } from '@/components/customer/unavailable-module';
export default function FilesPage() { return <UnavailableModule title="Pliki" description="Modele i dokumenty powiązane z zamówieniami." icon={Download} emptyTitle="Brak plików do pobrania" emptyDescription="Pliki produkcyjne i dokumenty będą widoczne tutaj po ich przypisaniu do zrealizowanego zamówienia." actionLabel="Zobacz zamówienia" actionHref="/panel/zamowienia" />; }
