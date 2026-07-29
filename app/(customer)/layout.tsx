import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel klienta',
  robots: { index: false, follow: false },
};

export default function CustomerGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
