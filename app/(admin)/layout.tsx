import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/providers';

export const metadata: Metadata = {
  title: 'Panel administratora',
  robots: { index: false, follow: false },
};

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
