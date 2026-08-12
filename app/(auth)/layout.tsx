import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'Konto klienta',
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
