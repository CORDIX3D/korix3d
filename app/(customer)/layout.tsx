import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';
import { WishlistProvider } from '@/lib/wishlist-provider';

export const metadata: Metadata = {
  title: 'Panel klienta',
  robots: { index: false, follow: false },
};

export default function CustomerGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WishlistProvider>{children}</WishlistProvider>
    </AuthProvider>
  );
}
