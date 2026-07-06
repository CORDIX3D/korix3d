'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  FileSpreadsheet,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Warehouse,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const quickLinks = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Zamówienia', href: '/admin/zamowienia', icon: ShoppingCart },
  { name: 'Sklep', href: '/admin/sklep-zamowienia', icon: ShoppingBag },
  { name: 'Produkty', href: '/admin/produkty', icon: Package },
  { name: 'Produkcja', href: '/admin/produkcja', icon: Boxes },
  { name: 'Magazyn', href: '/admin/magazyn', icon: Warehouse },
  { name: 'Klienci', href: '/admin/klienci', icon: Users },
  { name: 'Księgowość', href: '/admin/ksiegowosc', icon: FileSpreadsheet },
  { name: 'Raporty', href: '/admin/raporty-executive', icon: BarChart3 },
  { name: 'Ustawienia', href: '/admin/ustawienia', icon: Settings },
];

export function AdminQuickNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Szybkie przełączanie modułów administracyjnych"
      className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
        {quickLinks.map((item) => {
          const isActive = item.href === '/admin'
            ? pathname === '/admin'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
