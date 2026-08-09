import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centrum produkcji | KORIX3D',
  description: 'Mobilne centrum kalkulacji, zamówień i produkcji KORIX3D.',
  manifest: '/production.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'KORIX3D Produkcja',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
  robots: { index: false, follow: false },
};

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
