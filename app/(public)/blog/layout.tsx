import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Blog o druku 3D', description: 'Porady, technologie i praktyczna wiedza o profesjonalnym druku 3D.', alternates: { canonical: '/blog' } };
export default function BlogLayout({ children }: { children: React.ReactNode }) { return children; }
