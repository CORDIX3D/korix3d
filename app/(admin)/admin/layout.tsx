'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminQuickNav } from '@/components/layout/admin-quick-nav';
import { useAuth } from '@/lib/providers';
import { Toaster } from '@/components/ui/sonner';
import { AIWrapper } from '@/components/ai/ai-wrapper';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, isEmployee } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/logowanie?redirect=/admin');
    } else if (!loading && user && !isEmployee) {
      router.push('/panel');
    }
  }, [user, loading, isEmployee, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-muted-foreground">Ładowanie...</p>
        </div>
      </div>
    );
  }

  if (!user || !isEmployee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="lg:ml-72 min-h-screen transition-all">
        <div className="p-4 sm:p-6 lg:p-8">
          <AdminQuickNav />
          {children}
        </div>
      </main>
      <Toaster position="top-right" richColors closeButton />
      <AIWrapper />
    </div>
  );
}
