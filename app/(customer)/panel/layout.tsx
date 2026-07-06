'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import { CustomerSidebar } from '@/components/layout/customer-sidebar';
import { useAuth } from '@/lib/providers';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/logowanie?redirect=/panel');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="flex pt-16">
        <CustomerSidebar />
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
