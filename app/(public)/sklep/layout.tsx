import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Sklep z filamentami i produktami 3D', description: 'Filamenty, akcesoria i gotowe produkty dla druku 3D.', alternates: { canonical: '/sklep' } };
export default function ShopLayout({ children }: { children: React.ReactNode }) { return children; }
