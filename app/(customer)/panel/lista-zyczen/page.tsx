import { Heart } from 'lucide-react';
import { UnavailableModule } from '@/components/customer/unavailable-module';
export default function WishlistPage() { return <UnavailableModule title="Lista życzeń" description="Produkty zapisane na później." icon={Heart} emptyTitle="Lista życzeń jest pusta" emptyDescription="Zapisywanie ulubionych produktów pojawi się w kolejnej wersji sklepu. Obecnie możesz przeglądać pełną ofertę bezpośrednio w sklepie." actionLabel="Przejdź do sklepu" actionHref="/sklep" />; }
