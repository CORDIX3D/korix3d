'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag,
  FileText,
  Clock,
  Package,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';

interface StatCard {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description: string;
  color: string;
}

export default function CustomerDashboardPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError('');
    try {
      // Fetch orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders_3d')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch quotes
      const { data: quotes, error: quotesError } = await supabase
        .from('orders_3d')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['new', 'quoted'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError || quotesError) throw ordersError || quotesError;

      // Calculate stats
      const ordersData = orders as Array<{ status?: string; final_price?: string | number }> | undefined;
      const totalOrders = ordersData?.length || 0;
      const completedOrders = ordersData?.filter((o) => o.status === 'completed').length || 0;
      const pendingOrders = ordersData?.filter((o) => !['completed', 'cancelled'].includes(o.status || '')).length || 0;
      const totalSpent = ordersData
        ?.filter((o) => Boolean(o.final_price))
        .reduce((sum, o) => sum + Number(o.final_price), 0) || 0;

      setStats([
        {
          title: 'Wszystkie zamówienia',
          value: totalOrders,
          icon: ShoppingBag,
          description: 'Łącznie złożonych',
          color: 'text-blue-400',
        },
        {
          title: 'W realizacji',
          value: pendingOrders,
          icon: Clock,
          description: 'Trwa przetwarzanie',
          color: 'text-yellow-400',
        },
        {
          title: 'Zrealizowane',
          value: completedOrders,
          icon: CheckCircle2,
          description: 'Dostarczonych',
          color: 'text-green-400',
        },
        {
          title: 'Łączny wydatek',
          value: `${totalSpent.toFixed(2)} zł`,
          icon: TrendingUp,
          description: 'Wartość zamówień',
          color: 'text-primary',
        },
      ]);

      setRecentOrders((orders || []).slice(0, 5));
      setRecentQuotes(quotes || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Nie udało się pobrać podsumowania konta. Sprawdź połączenie i spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) void fetchDashboardData();
  }, [user, fetchDashboardData]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      new: { label: 'Nowe', className: 'status-new' },
      quoted: { label: 'Otrzymano wycenę', className: 'status-quoted' },
      accepted: { label: 'Zaakceptowane', className: 'status-accepted' },
      queued: { label: 'W kolejce', className: 'status-pending' },
      printing: { label: 'Drukowanie', className: 'status-printing' },
      post_processing: { label: 'Post-processing', className: 'status-printing' },
      packed: { label: 'Spakowane', className: 'status-accepted' },
      shipped: { label: 'Wysłane', className: 'status-printing' },
      completed: { label: 'Zrealizowane', className: 'status-completed' },
      cancelled: { label: 'Anulowane', className: 'status-cancelled' },
    };

    const config = statusConfig[status] || { label: status, className: 'status-pending' };
    return <span className={`status-badge ${config.className}`}>{config.label}</span>;
  };

  if (loading) return <PanelLoading label="Przygotowywanie panelu..." />;
  if (error) return <PanelError message={error} onRetry={fetchDashboardData} />;

  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Kliencie';
  const isNewCustomer = recentOrders.length === 0;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Witaj, {displayName}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Oto podsumowanie Twojego konta
        </p>
      </div>

      {isNewCustomer && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/10 to-orange-600/5">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Zacznij pierwsze zlecenie</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prześlij model, wybierz parametry i poczekaj na indywidualną wycenę.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  {['1. Prześlij plik 3D', '2. Uzupełnij parametry', '3. Odbierz wycenę'].map((step) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />{step}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!profile?.full_name && (
                  <Button asChild variant="outline"><Link href="/panel/ustawienia">Uzupełnij profil</Link></Button>
                )}
                <Button asChild><Link href="/wycena">Rozpocznij wycenę</Link></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/wycena">
          <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Printer className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Nowa wycena</h3>
                <p className="text-sm text-muted-foreground">Zleć wydruk 3D</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/sklep">
          <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Package className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Sklep</h3>
                <p className="text-sm text-muted-foreground">Przeglądaj produkty</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/panel/zamowienia">
          <Card className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <ShoppingBag className="w-6 h-6 text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Moje zamówienia</h3>
                <p className="text-sm text-muted-foreground">Sprawdź status</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders & Quotes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              Ostatnie zamówienia
            </CardTitle>
            <Link href="/panel/zamowienia">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                Zobacz wszystkie
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Brak zamówień</p>
                <Link href="/wycena">
                  <Button className="mt-4 bg-primary hover:bg-primary/90">
                    Złóż pierwsze zamówienie
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/panel/zamowienia/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{order.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.material_name} • {order.quantity} szt.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Złożono {new Date(order.created_at).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                    {getStatusBadge(order.status)}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Quotes */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">
              Oczekujące wyceny
            </CardTitle>
            <Link href="/panel/wyceny">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                Zobacz wszystkie
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Brak oczekujących wycen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">{quote.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quote.created_at).toLocaleDateString('pl-PL')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {quote.status === 'quoted' ? (
                        <>
                          <span className="text-sm font-medium text-foreground">
                            {quote.final_price?.toFixed(2)} zł
                          </span>
                          <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                            <Link href={`/panel/zamowienia/${quote.id}`}>Zobacz wycenę</Link>
                          </Button>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Oczekuje na wycenę</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-orange-600/10 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground mb-1">
                Potrzebujesz pomocy?
              </h3>
              <p className="text-sm text-muted-foreground">
                Nasz zespół dostępny jest od poniedziałku do piątku w godzinach 9:00-17:00.
                Skontaktuj się z nami przez formularz kontaktowy.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
