import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Materiały do druku 3D', description: 'Porównaj właściwości i parametry materiałów wykorzystywanych przez KORIX3D.', alternates: { canonical: '/materialy' } };
export default function MaterialsLayout({ children }: { children: React.ReactNode }) { return children; }
