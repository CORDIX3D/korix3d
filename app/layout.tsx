import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/lib/providers';
import { CartProvider } from '@/lib/cart-provider';

export const metadata: Metadata = {
  title: 'KORIX3D - Profesjonalny Druk 3D | Od pomysłu do rzeczywistości',
  description: 'KORIX3D - Profesjonalny druk 3D, szybkie prototypowanie, części inżynieryjne. Oferujemy usługi druku 3D, sprzedaż filamentów i akcesoriów. Od pomysłu do rzeczywistości.',
  keywords: ['druk 3D', 'prototypowanie', 'filamenty', 'PLA', 'PETG', 'ABS', 'części inżynieryjne', 'produkcja', 'Warszawa', 'Polska'],
  authors: [{ name: 'KORIX3D' }],
  creator: 'KORIX3D',
  publisher: 'KORIX3D',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://korix3d.pl'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'pl_PL',
    url: 'https://korix3d.pl',
    siteName: 'KORIX3D',
    title: 'KORIX3D - Profesjonalny Druk 3D',
    description: 'Profesjonalny druk 3D, szybkie prototypowanie, części inżynieryjne. Od pomysłu do rzeczywistości.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KORIX3D - Profesjonalny Druk 3D',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KORIX3D - Profesjonalny Druk 3D',
    description: 'Profesjonalny druk 3D, szybkie prototypowanie, części inżynieryjne.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className="dark">
      <body className="font-sans antialiased">
        <AuthProvider>
          <CartProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
