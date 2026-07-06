'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag,
  DollarSign,
  Users,
  Printer,
  TrendingUp,
  TrendingDown,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { supabase } from '@/lib/supabase/client';

// Mock data for charts
const revenueData = [
  { month: 'Sty', revenue: 12500, orders: 45 },
  { month: 'Lut', revenue: 15200, orders: 52 },
  { month: 'Mar', revenue: 18900, orders: 68 },
  { month: 'Kwi', revenue: 16700, orders: 55 },
  { month: 'Maj', revenue: 21400, orders: 78 },
  { month: 'Cze', revenue: 24800, orders: 89 },
];

const materialUsageData = [
  { name: 'PLA', usage: 45, color: '#22c55e' },
  { name: 'PETG', usage: 28, color: '#3b82f6' },
  { name: 'ABS', usage: 12, color: '#ef4444' },
  { name: 'TPU', usage: 8, color: '#a855f7' },
  { name: 'Inne', usage: 7, color: '#6b7280' },
];

interface DashboardStats {
  totalRevenue: number;
  revenueChange: number;
  pendingOrders: number;
  ordersChange: number;
  newCustomers: number;
  customersChange: number;
  printingHours: number;
  printingChange: number;
  pendingQuotes: number;
  lowStockItems: number;
  lowFilamentSpools: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    revenueChange: 0,
    pendingOrders: 0,
    ordersChange: 0,
    newCustomers: 0,
    customersChange: 0,
    printingHours: 0,
    printingChange: 0,
    pendingQuotes: 0,
    lowStockItems: 0,
    lowFilamentSpools: 0,
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch orders
      const { data: orders } = await supabase
        .from('orders_3d')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch pending quotes
      const { data: quotes } = await supabase
        .from('orders_3d')
        .select('*')
        .eq('status', 'new');

      // Fetch profiles count
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id');

      // Fetch filament spools with low weight
      const { data: filaments } = await supabase
        .from('filaments')
        .select('*')
        .eq('active', true);

      const lowFilaments = filaments?.filter(
        (f) => f.remaining_weight_grams <= (f.min_weight_grams || 100)
      ).length || 0;

      // Calculate stats
      const totalRevenue = orders?.reduce(
        (sum, o) => sum + (Number(o.final_price) || 0),
        0
      ) || 0;

      const pendingOrders = orders?.filter(
        (o) => !['completed', 'cancelled'].includes(o.status)
      ).length || 0;

      const printingHours = orders?.reduce(
        (sum, o) => sum + (Number(o.printing_time_hours) || 0),
        0
      ) || 0;

      setStats({
        totalRevenue,
        revenueChange: 12.5, // Mock percentage change
        pendingOrders,
        ordersChange: -2.3,
        newCustomers: profiles?.length || 0,
        customersChange: 8.2,
        printingHours,
        printingChange: 5.4,
        pendingQuotes: quotes?.length || 0,
        lowStockItems: 0,
        lowFilamentSpools: lowFilaments,
      });

      setRecentOrders(orders || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      new: { label: 'Nowe', className: 'status-new' },
      quoted: { label: 'Wyceniono', className: 'status-quoted' },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Przegląd aktywności i statystyki
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="today">Dzisiaj</option>
            <option value="week">Ten tydzień</option>
            <option value="month">Ten miesiąc</option>
            <option value="year">Ten rok</option>
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Przychód</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalRevenue.toLocaleString('pl-PL')} zł
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {stats.revenueChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm ${
                      stats.revenueChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {stats.revenueChange}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs poprzedni miesiąc</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Oczekujące zamówienia</p>
                <p className="text-2xl font-bold text-foreground">{stats.pendingOrders}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stats.ordersChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm ${
                      stats.ordersChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {Math.abs(stats.ordersChange)}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs poprzedni tydzień</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customers Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Klienci</p>
                <p className="text-2xl font-bold text-foreground">{stats.newCustomers}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stats.customersChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm ${
                      stats.customersChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {stats.customersChange}%
                  </span>
                  <span className="text-sm text-muted-foreground">w tym miesiącu</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Printing Hours Card */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Godziny druku</p>
                <p className="text-2xl font-bold text-foreground">{stats.printingHours.toFixed(1)}h</p>
                <div className="flex items-center gap-1 mt-2">
                  {stats.printingChange >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <span
                    className={`text-sm ${
                      stats.printingChange >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {stats.printingChange}%
                  </span>
                  <span className="text-sm text-muted-foreground">vs poprzedni miesiąc</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Printer className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Row */}
      {(stats.pendingQuotes > 0 || stats.lowFilamentSpools > 0) && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.pendingQuotes > 0 && (
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-yellow-400" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {stats.pendingQuotes} nowych wycen
                  </p>
                  <p className="text-sm text-muted-foreground">Oczekuje na wycenę</p>
                </div>
                <Button size="sm" className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
                  Przejdź
                </Button>
              </CardContent>
            </Card>
          )}

          {stats.lowFilamentSpools > 0 && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {stats.lowFilamentSpools} szpulek kończy się
                  </p>
                  <p className="text-sm text-muted-foreground">Niski stan filamentu</p>
                </div>
                <Button size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30">
                  Sprawdź
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Przychody</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF6A00" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF6A00" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                  <XAxis dataKey="month" stroke="#737373" fontSize={12} />
                  <YAxis stroke="#737373" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151515',
                      border: '1px solid #252525',
                      borderRadius: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#FF6A00"
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Material Usage Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Użycie materiałów</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialUsageData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
                  <XAxis type="number" stroke="#737373" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#737373" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#151515',
                      border: '1px solid #252525',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="usage" radius={[0, 4, 4, 0]}>
                    {materialUsageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg text-foreground">Ostatnie zamówienia</CardTitle>
          <Button variant="outline" size="sm">
            Zobacz wszystkie
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Numer zamówienia</th>
                  <th>Materiał</th>
                  <th>Ilość</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Kwota</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td className="font-medium text-primary">{order.order_number}</td>
                    <td>{order.material_name || '—'}</td>
                    <td>{order.quantity}</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td>
                      {new Date(order.created_at).toLocaleDateString('pl-PL')}
                    </td>
                    <td className="font-medium">
                      {order.final_price ? `${order.final_price.toFixed(2)} zł` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
