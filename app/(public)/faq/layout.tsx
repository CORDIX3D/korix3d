import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Najczęstsze pytania o druk 3D',
  description: 'Odpowiedzi na pytania o wycenę, materiały, przygotowanie modeli, płatność i realizację druku 3D w KORIX3D.',
  alternates: { canonical: '/faq' },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
