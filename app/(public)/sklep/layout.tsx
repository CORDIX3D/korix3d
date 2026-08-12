import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';
import { WishlistProvider } from '@/lib/wishlist-provider';
export const metadata: Metadata = { title: 'Sklep z filamentami i produktami 3D', description: 'Filamenty, akcesoria i gotowe produkty dla druku 3D.', alternates: { canonical: '/sklep' } };
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WishlistProvider>{children}</WishlistProvider>
    </AuthProvider>
  );
}
