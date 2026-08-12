import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';
export const metadata: Metadata = { title: 'Wycena druku 3D', description: 'Prześlij model i skonfiguruj parametry, aby otrzymać wycenę druku 3D.', alternates: { canonical: '/wycena' } };
export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
