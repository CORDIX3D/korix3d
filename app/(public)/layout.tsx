import { PublicHeader } from '@/components/layout/public-header';
import { PublicFooter } from '@/components/layout/public-footer';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1 pt-16">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
