import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Portfolio realizacji', description: 'Wybrane realizacje druku 3D wykonane przez KORIX3D.', alternates: { canonical: '/portfolio' } };
export default function PortfolioLayout({ children }: { children: React.ReactNode }) { return children; }
