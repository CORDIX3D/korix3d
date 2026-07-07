'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  Eye,
  MoreHorizontal,
  Printer,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  Calculator,
  Send,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { Order3D } from '@/lib/types/database';
import { toast } from 'sonner';
import { PanelError } from '@/components/customer/panel-state';
import { OrderFileDownload, StoredOrderFile } from '@/components/customer/order-file-download';

const statusOptions = [
  { value: 'all', label: 'Wszystkie statusy' },
  { value: 'new', label: 'Nowe' },
  { value: 'quoted', label: 'Wyceniono' },
  { value: 'accepted', label: 'Zaakceptowane' },
  { value: 'queued', label: 'W kolejce' },
  { value: 'printing', label: 'Drukowanie' },
  { value: 'post_processing', label: 'Post-processing' },
  { value: 'packed', label: 'Spakowane' },
  { value: 'shipped', label: 'Wysłane' },
  { value: 'completed', label: 'Zrealizowane' },
  { value: 'cancelled', label: 'Anulowane' },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order3D[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order3D | null>(null);
  const [quoteDialog, setQuoteDialog] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    printing_time_hours: '',
    filament_used_grams: '',
    final_price: '',
    admin_notes: '',
  });

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    let query = supabase
      .from('orders_3d')
      .select('*')
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%`);
    }

    const { data, error: queryError } = await query.limit(50);
    if (queryError) setError('Nie udało się pobrać zamówień z Supabase.');
    else setOrders((data || []) as Order3D[]);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders_3d')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      toast.error('Błąd', { description: 'Nie udało się zaktualizować statusu' });
    } else {
      toast.success('Status zaktualizowany');
      fetchOrders();
    }
  };

  const submitQuote = async () => {
    if (!selectedOrder) return;

    const printingTime = Number(quoteForm.printing_time_hours);
    const filamentWeight = Number(quoteForm.filament_used_grams);
    const finalPrice = Number(quoteForm.final_price);
    if (!Number.isFinite(printingTime) || printingTime <= 0 || !Number.isFinite(filamentWeight) || filamentWeight <= 0 || !Number.isFinite(finalPrice) || finalPrice <= 0) {
      toast.error('Uzupełnij wycenę', { description: 'Czas druku, ilość filamentu i cena muszą być większe od zera.' });
      return;
    }

    setSubmittingQuote(true);

    const { error } = await supabase
      .from('orders_3d')
      .update({
        status: 'quoted',
        printing_time_hours: printingTime,
        filament_used_grams: filamentWeight,
        final_price: finalPrice,
        admin_notes: quoteForm.admin_notes.trim() || null,
      })
      .eq('id', selectedOrder.id);

    if (error) {
      toast.error('Błąd', { description: 'Nie udało się zapisać wyceny' });
    } else {
      toast.success('Wycena wysłana');
      setQuoteDialog(false);
      fetchOrders();
    }
    setSubmittingQuote(false);
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; className: string; icon: React.ElementType }> = {
      new: { label: 'Nowe', className: 'status-new', icon: AlertTriangle },
      quoted: { label: 'Wyceniono', className: 'status-quoted', icon: FileText },
      accepted: { label: 'Zaakceptowane', className: 'status-accepted', icon: CheckCircle2 },
      queued: { label: 'W kolejce', className: 'status-pending', icon: Clock },
      printing: { label: 'Drukowanie', className: 'status-printing', icon: Printer },
      post_processing: { label: 'Post-processing', className: 'status-printing', icon: RefreshCw },
      packed: { label: 'Spakowane', className: 'status-accepted', icon: CheckCircle2 },
      shipped: { label: 'Wysłane', className: 'status-printing', icon: Send },
      completed: { label: 'Zrealizowane', className: 'status-completed', icon: CheckCircle2 },
      cancelled: { label: 'Anulowane', className: 'status-cancelled', icon: XCircle },
    };
    return configs[status] || { label: status, className: 'status-pending', icon: Clock };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Zamówienia 3D
          </h1>
          <p className="text-muted-foreground mt-1">
            Zarządzaj zamówieniami na wydruki 3D
          </p>
        </div>
        <Button onClick={fetchOrders} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Odśwież
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj po numerze zamówienia..."
                className="pl-12 h-11 bg-secondary border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48 h-11 bg-secondary border-border">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchOrders} className="h-11">
              Szukaj
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="p-6"><PanelError message={error} onRetry={fetchOrders} /></div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Brak zamówień</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Numer</th>
                    <th>Data</th>
                    <th>Materiał</th>
                    <th>Ilość</th>
                    <th>Status</th>
                    <th>Cena</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusConfig = getStatusConfig(order.status);
                    return (
                      <tr key={order.id}>
                        <td className="font-medium text-primary">
                          {order.order_number}
                        </td>
                        <td>{new Date(order.created_at).toLocaleDateString('pl-PL')}</td>
                        <td>{order.material_name || '—'}</td>
                        <td>{order.quantity}</td>
                        <td>
                          <span className={`status-badge ${statusConfig.className} flex items-center gap-1`}>
                            <statusConfig.icon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="font-medium">
                          {order.final_price ? `${order.final_price.toFixed(2)} zł` : '—'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedOrder(order);
                                setQuoteForm({ printing_time_hours: '', filament_used_grams: '', final_price: '', admin_notes: '' });
                                setQuoteDialog(true);
                              }}
                            >
                              {order.status === 'new' ? (
                                <>
                                  <Calculator className="w-4 h-4" />
                                  Wycen
                                </>
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Select
                              value={order.status}
                              onValueChange={(value) => updateOrderStatus(order.id, value)}
                            >
                              <SelectTrigger className="w-8 h-8 p-0 bg-transparent border-0">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border">
                                {statusOptions
                                  .filter((s) => s.value !== 'all')
                                  .map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quote Dialog */}
      <Dialog open={quoteDialog} onOpenChange={setQuoteDialog}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedOrder?.status === 'new' ? 'Wycena' : 'Szczegóły zamówienia'}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">Numer zamówienia</p>
                  <p className="font-medium text-foreground">{selectedOrder.order_number}</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">Materiał</p>
                  <p className="font-medium text-foreground">{selectedOrder.material_name || '—'}</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">Kolor</p>
                  <p className="font-medium text-foreground">{selectedOrder.color || '—'}</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-xs text-muted-foreground">Ilość</p>
                  <p className="font-medium text-foreground">{selectedOrder.quantity} szt.</p>
                </div>
              </div>

              {/* Files */}
              {selectedOrder.files && (selectedOrder.files as any[]).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Pliki</p>
                  <div className="space-y-2">
                    {(selectedOrder.files as StoredOrderFile[]).map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2 bg-secondary rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm text-foreground">{file.name}</span>
                        </div>
                        <OrderFileDownload file={file} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quote Form */}
              {selectedOrder.status === 'new' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="form-label">Czas druku (h)</label>
                      <Input
                        type="number"
                        step="0.1"
                        value={quoteForm.printing_time_hours}
                        onChange={(e) =>
                          setQuoteForm({ ...quoteForm, printing_time_hours: e.target.value })
                        }
                        className="h-11 bg-secondary border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="form-label">Filament (g)</label>
                      <Input
                        type="number"
                        value={quoteForm.filament_used_grams}
                        onChange={(e) =>
                          setQuoteForm({ ...quoteForm, filament_used_grams: e.target.value })
                        }
                        className="h-11 bg-secondary border-border"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Cena końcowa (zł)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={quoteForm.final_price}
                      onChange={(e) =>
                        setQuoteForm({ ...quoteForm, final_price: e.target.value })
                      }
                      className="h-11 bg-secondary border-border text-xl font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="form-label">Notatki</label>
                    <textarea
                      value={quoteForm.admin_notes}
                      onChange={(e) =>
                        setQuoteForm({ ...quoteForm, admin_notes: e.target.value })
                      }
                      className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-foreground"
                      placeholder="Dodatkowe informacje dla klienta..."
                    />
                  </div>
                </div>
              )}

              {/* Display Existing Quote */}
              {selectedOrder.status !== 'new' && selectedOrder.final_price && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Cena</p>
                    <p className="text-3xl font-bold text-primary">
                      {selectedOrder.final_price.toFixed(2)} zł
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Czas druku:</span>{' '}
                      <span className="text-foreground">
                        {selectedOrder.printing_time_hours}h
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Filament:</span>{' '}
                      <span className="text-foreground">
                        {selectedOrder.filament_used_grams}g
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {selectedOrder.status === 'new' && (
                  <Button
                    onClick={submitQuote}
                    disabled={submittingQuote}
                    className="flex-1 bg-gradient-primary hover:shadow-glow"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {submittingQuote ? 'Zapisywanie...' : 'Wyślij wycenę'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setQuoteDialog(false)}
                  className="flex-1"
                >
                  Zamknij
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
