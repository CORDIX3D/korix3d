'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
  Heart,
  Download,
  Bell,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/providers';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const sidebarItems = [
  { name: 'Dashboard', href: '/panel', icon: LayoutDashboard },
  { name: 'Zamówienia', href: '/panel/zamowienia', icon: ShoppingBag },
  { name: 'Wyceny', href: '/panel/wyceny', icon: FileText },
  { name: 'Lista życzeń', href: '/panel/lista-zyczen', icon: Heart },
  { name: 'Pliki', href: '/panel/pliki', icon: Download },
  { name: 'Powiadomienia', href: '/panel/powiadomienia', icon: Bell },
  { name: 'Wiadomości', href: '/panel/wiadomosci', icon: MessageSquare },
  { name: 'Ustawienia', href: '/panel/ustawienia', icon: Settings },
];

export function CustomerSidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        type="button"
        className="lg:hidden fixed top-20 left-4 z-40 p-2 bg-card border border-border rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Zamknij menu klienta' : 'Otwórz menu klienta'}
        aria-expanded={mobileOpen}
      >
        <Menu className="w-5 h-5 text-foreground" />
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
          'fixed top-16 left-0 h-[calc(100vh-4rem)] bg-card border-r border-border z-40 transition-all duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            {!collapsed && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {profile?.full_name?.[0] || 'U'}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <div className="font-semibold text-foreground truncate">
                    {profile?.full_name || 'Użytkownik'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {profile?.email}
                  </div>
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

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {sidebarItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary border-l-2 border-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <button
              onClick={() => signOut()}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all'
              )}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>Wyloguj się</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
