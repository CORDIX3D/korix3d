'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  FileSpreadsheet,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Calendar,
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Mail,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { AccountingReport } from '@/lib/types/database';

interface ReportSummary {
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  [key: string]: number | undefined;
}

interface Report extends Omit<AccountingReport, 'summary'> {
  summary: ReportSummary;
}

const MONTHS = [
  { value: '1', label: 'Styczeń' },
  { value: '2', label: 'Luty' },
  { value: '3', label: 'Marzec' },
  { value: '4', label: 'Kwiecień' },
  { value: '5', label: 'Maj' },
  { value: '6', label: 'Czerwiec' },
  { value: '7', label: 'Lipiec' },
  { value: '8', label: 'Sierpień' },
  { value: '9', label: 'Wrzesień' },
  { value: '10', label: 'Październik' },
  { value: '11', label: 'Listopad' },
  { value: '12', label: 'Grudzień' },
];

export default function AccountingPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth() + 1).toString());
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/reports?year=${selectedYear}`);
      const data = await response.json();

      if (response.ok) {
        setReports(data.reports || []);
      } else {
        toast.error('Błąd', { description: data.error });
      }
    } catch (error) {
      toast.error('Błąd', { description: 'Nie udało się pobrać raportów' });
    }
    setLoading(false);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/accounting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(selectedYear),
          month: parseInt(selectedMonth)
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Raport wygenerowany', { description: `Plik: ${data.report.fileName}` });
        setShowGenerateDialog(false);
        fetchReports();
      } else if (response.status === 409) {
        toast.warning('Raport istnieje', { description: data.error });
      } else {
        toast.error('Błąd', { description: data.error });
      }
    } catch (error) {
      toast.error('Błąd', { description: 'Nie udało się wygenerować raportu' });
    }
    setGenerating(false);
  };

  const downloadReport = async (reportId: string, fileName: string) => {
    try {
      const response = await fetch(`/api/accounting/download?id=${reportId}`);

      if (!response.ok) {
        throw new Error('Błąd pobierania');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Pobrano', { description: fileName });
    } catch (error) {
      toast.error('Błąd', { description: 'Nie udało się pobrać raportu' });
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten raport?')) return;

    try {
      const response = await fetch('/api/accounting/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Usunięto', { description: 'Raport został usunięty' });
        fetchReports();
      } else {
        toast.error('Błąd', { description: data.error });
      }
    } catch (error) {
      toast.error('Błąd', { description: 'Nie udało się usunąć raportu' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      generated: { variant: 'default', label: 'Wygenerowany' },
      generating: { variant: 'secondary', label: 'Generowanie...' },
      sent: { variant: 'outline', label: 'Wysłany' },
      failed: { variant: 'destructive', label: 'Błąd' }
    };

    const config = variants[status] || { variant: 'outline', label: status };

    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(value || 0);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Calculate stats
  const totalReports = reports.length;
  const currentYearReports = reports.filter(r => r.report_year === new Date().getFullYear()).length;
  const totalRevenue = reports.reduce((sum, r) => sum + (r.summary?.revenue || 0), 0);
  const totalProfit = reports.reduce((sum, r) => sum + (r.summary?.profit || 0), 0);

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) {
    years.push(y.toString());
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            Księgowość
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatyczne raporty finansowe i księgowe
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchReports} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:shadow-glow">
                <Plus className="w-4 h-4 mr-2" />
                Nowy raport
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generuj nowy raport</DialogTitle>
                <DialogDescription>
                  Wybierz miesiąc i rok dla którego chcesz wygenerować raport finansowy
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rok</label>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Miesiąc</label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map(m => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                    Anuluj
                  </Button>
                  <Button onClick={generateReport} disabled={generating}>
                    {generating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                    )}
                    Generuj
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-full">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalReports}</p>
                <p className="text-xs text-muted-foreground">Raportów</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-full">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Suma przychodów</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-full">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalProfit)}</p>
                <p className="text-xs text-muted-foreground">Suma zysków</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-full">
                <Calendar className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{currentYearReports}</p>
                <p className="text-xs text-muted-foreground">W tym roku</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-foreground">Lista raportów</CardTitle>
              <CardDescription>
                Automatycznie generowane raporty finansowe
              </CardDescription>
            </div>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileSpreadsheet className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Brak raportów za wybrany rok</p>
              <Button onClick={() => setShowGenerateDialog(true)} variant="outline" className="mt-4">
                <Plus className="w-4 h-4 mr-2" />
                Wygeneruj pierwszy raport
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okres</TableHead>
                  <TableHead>Plik</TableHead>
                  <TableHead>Przychód</TableHead>
                  <TableHead>Zysk</TableHead>
                  <TableHead>Marża</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(report.report_month), 'MMMM yyyy', { locale: pl })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-green-500" />
                        <span className="text-sm">{report.file_name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(report.file_size || 0)})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        {formatCurrency(report.summary?.revenue || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${(report.summary?.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatCurrency(report.summary?.profit || 0)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{(report.summary?.margin || 0).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(report.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(report.generated_at), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadReport(report.id, report.file_name)}
                          title="Pobierz"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteReport(report.id)}
                          className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                          title="Usuń"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Automatyczna generacja
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Raporty księgowe są automatycznie generowane pierwszego dnia każdego miesiąca.
            Każdy raport zawiera szczegółową analizę finansową z 15 arkuszami Excel.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-sm font-medium">Analiza przychodów</p>
              <p className="text-xs text-muted-foreground">Szczegółowa analiza sprzedaży</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <BarChart3 className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-sm font-medium">Statystyki produkcji</p>
              <p className="text-xs text-muted-foreground">Wydajność i wykorzystanie</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <TrendingUp className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-medium">Analiza AI</p>
              <p className="text-xs text-muted-foreground">Rekomendacje i prognozy</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
