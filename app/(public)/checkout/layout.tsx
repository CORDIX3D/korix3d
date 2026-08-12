import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'Finalizacja zamówienia',
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
