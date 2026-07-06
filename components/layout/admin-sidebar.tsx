'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Package,
  FileText,
 Layers,
  Box,
  Settings,
  ChevronLeft,
  Menu,
  X,
  Printer,
  PenTool,
  Tag,
  Truck,
  Percent,
  Bell,
  BarChart3,
  Building2,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/providers';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const adminNav = [
  {
    title: 'Główne',
    items: [
      { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Analityka', href: '/admin/analityka', icon: BarChart3 },
    ],
  },
  {
    title: 'Zamówienia',
    items: [
      { name: 'Zamówienia 3D', href: '/admin/zamowienia', icon: Printer },
      { name: 'Zamówienia sklep', href: '/admin/sklep-zamowienia', icon: ShoppingBag },
      { name: 'Wyceny', href: '/admin/wyceny', icon: FileText },
    ],
  },
  {
    title: 'Produkcja',
    items: [
      { name: 'Kolejka druku', href: '/admin/produkcja', icon: Layers },
      { name: 'Harmonogram', href: '/admin/produkcja/harmonogram', icon: Clock },
      { name: 'Statystyki', href: '/admin/produkcja/statystyki', icon: BarChart3 },
    ],
  },
  {
    title: 'Katalog',
    items: [
      { name: 'Produkty', href: '/admin/produkty', icon: Package },
      { name: 'Kategorie', href: '/admin/produkty/kategorie', icon: Tag },
      { name: 'Materiały', href: '/admin/materialy', icon: Box },
      { name: 'Kolory', href: '/admin/materialy/kolory', icon: Palette },
    ],
  },
  {
    title: 'Magazyn',
    items: [
      { name: 'Magazyn', href: '/admin/magazyn', icon: Building2 },
      { name: 'Filamenty', href: '/admin/filamenty', icon: Layers },
    ],
  },
  {
    title: 'CRM',
    items: [
      { name: 'Klienci', href: '/admin/klienci', icon: Users },
      { name: 'Wiadomości', href: '/admin/wiadomosci', icon: Mail },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { name: 'Kupony', href: '/admin/kupony', icon: Percent },
      { name: 'Dostawa', href: '/admin/dostawa', icon: Truck },
    ],
  },
  {
    title: 'Treści',
    items: [
      { name: 'Blog', href: '/admin/blog', icon: PenTool },
      { name: 'FAQ', href: '/admin/faq', icon: FileText },
      { name: 'Portfolio', href: '/admin/portfolio', icon: Image },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Pracownicy', href: '/admin/pracownicy', icon: Users },
      { name: 'Ustawienia', href: '/admin/ustawienia', icon: Settings },
      { name: 'Powiadomienia', href: '/admin/powiadomienia', icon: Bell },
    ],
  },
];

import { Clock } from 'lucide-react';
import { Mail } from 'lucide-react';
import { Image } from 'lucide-react';

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-20 left-4 z-40 p-2 bg-card border border-border rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-foreground" />
        ) : (
          <Menu className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-card border-r border-border z-50 transition-all duration-300 overflow-hidden',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-20' : 'lg:w-72',
          'w-72'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold">K</span>
                  </div>
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-gradient">KORIX3D</div>
                  <div className="text-xs text-muted-foreground">Panel administratora</div>
                </div>
              </div>
            )}
            <button
              className="hidden lg:flex p-2 hover:bg-secondary rounded-lg transition-colors"
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform',
                  collapsed && 'rotate-180'
                )}
              />
            </button>
          </div>

          {/* User Info */}
          {!collapsed && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {profile?.full_name?.[0] || 'A'}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold text-foreground truncate">
                    {profile?.full_name || 'Administrator'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {profile?.role === 'admin' ? 'Administrator' : 'Pracownik'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {adminNav.map((section) => (
              <div key={section.title} className="mb-4">
                {!collapsed && (
                  <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                          collapsed && 'justify-center'
                        )}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.name : undefined}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && <span className="truncate text-sm">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <Link
              href="/"
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-all',
                collapsed && 'justify-center'
              )}
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm">Powrót do strony</span>}
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
