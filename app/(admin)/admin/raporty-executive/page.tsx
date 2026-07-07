'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Brain,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Calendar,
  TrendingUp,
  BarChart3,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Eye,
  Archive,
  Printer,
  Sparkles,
  Target,
  Shield,
  AlertCircle,
  TrendingDown,
  Users,
  Package,
  Zap,
  DollarSign,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PanelError } from '@/components/customer/panel-state';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface CompanyScores {
  financialHealth: number;
  productionEfficiency: number;
  warehouseManagement: number;
  customerSatisfaction: number;
  businessGrowth: number;
  overallScore: number;
}

interface ExecutiveReportData {
  id: string;
  report_month: string;
  report_year: number;
  title: string;
  summary: string;
  full_report: Record<string, unknown> | null;
  scores: CompanyScores | null;
  recommendations: Array<{ priority: string; category: string; action: string; expectedImpact: string; details: string }> | null;
  risks: Array<{ level: string; category: string; title: string; description: string; probability: number; impact: string; mitigation: string }> | null;
  forecast: { revenue: { value: number; confidence: number }; profit: { value: number; confidence: number }; orders: { value: number; confidence: number }; assumptions: string[] } | null;
  insights: Array<{ type: string; category: string; title: string; description: string; recommendation?: string }> | null;
  notifications: Array<{ type: string; title: string; message: string; priority: string }> | null;
  status: string;
  generated_at: string;
  created_at: string;
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

export default function ExecutiveReportsPage() {
  const [reports, setReports] = useState<ExecutiveReportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>((new Date().getMonth()).toString());
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [viewingReport, setViewingReport] = useState<ExecutiveReportData | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchReports();
  }, [selectedYear]);

  const fetchReports = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch(`/api/executive/reports?year=${selectedYear}`);
      const data = await response.json();

      if (response.ok) {
        setReports(data.data || []);
      } else {
        setLoadError(data.error || 'Nie udało się pobrać raportów.');
        toast.error('Błąd', { description: data.error });
      }
    } catch {
      setLoadError('Nie udało się połączyć z usługą raportów AI.');
      toast.error('Błąd', { description: 'Nie udało się pobrać raportów' });
    }
    setLoading(false);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/executive/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(selectedYear),
          month: parseInt(selectedMonth)
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Raport wygenerowany', { description: 'AI Executive Report gotowy' });
        setShowGenerateDialog(false);
        fetchReports();
      } else {
        toast.error('Błąd', { description: data.error });
      }
    } catch {
      toast.error('Błąd', { description: 'Nie udało się wygenerować raportu' });
    }
    setGenerating(false);
  };

  const viewReport = async (id: string) => {
    try {
      const response = await fetch(`/api/executive/reports/${id}`);
      const data = await response.json();

      if (response.ok) {
        setViewingReport(data.data);
        setShowViewDialog(true);
      } else {
        toast.error('Błąd', { description: data.error });
      }
    } catch {
      toast.error('Błąd', { description: 'Nie udało się pobrać raportu' });
    }
  };

  const archiveReport = async (id: string) => {
    try {
      const response = await fetch(`/api/executive/reports/${id}/archive`, {
        method: 'POST'
      });

      if (response.ok) {
        toast.success('Zarchiwizowano', { description: 'Raport został przeniesiony do archiwum' });
        fetchReports();
      } else {
        const data = await response.json();
        toast.error('Błąd', { description: data.error });
      }
    } catch {
      toast.error('Błąd', { description: 'Nie udało się zarchiwizować raportu' });
    }
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten raport?')) return;

    try {
      const response = await fetch(`/api/executive/reports?id=${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Usunięto', { description: 'Raport został usunięty' });
        fetchReports();
      } else {
        const data = await response.json();
        toast.error('Błąd', { description: data.error });
      }
    } catch {
      toast.error('Błąd', { description: 'Nie udało się usunąć raportu' });
    }
  };

  const printReport = () => {
    if (viewingReport) {
      const printContent = document.getElementById('report-content');
      if (printContent) {
        const printWindow = window.open('', '', 'height=800,width=1000');
        printWindow?.document.write('<html><head><title>Raport AI</title>');
        printWindow?.document.write('<style>body{font-family:Arial;padding:20px}h1,h2{color:#FF6A00}pre{white-space:pre-wrap}</style>');
        printWindow?.document.write('</head><body>');
        printWindow?.document.write(printContent.innerHTML);
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.print();
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className: string }> = {
      generated: { variant: 'default', label: 'Wygenerowany', className: 'bg-green-500/20 text-green-500 border-green-500/30' },
      generating: { variant: 'secondary', label: 'Generowanie...', className: 'bg-yellow-500/20 text-yellow-500' },
      sent: { variant: 'outline', label: 'Wysłany', className: 'bg-blue-500/20 text-blue-500' },
      archived: { variant: 'outline', label: 'Zarchiwizowany', className: 'bg-gray-500/20 text-gray-500' },
      failed: { variant: 'destructive', label: 'Błąd', className: 'bg-red-500/20 text-red-500' }
    };

    const config = variants[status] || { variant: 'outline', label: status, className: '' };

    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRiskBadge = (level: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      low: { bg: 'bg-green-500/20', text: 'text-green-500' },
      medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
      high: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
      critical: { bg: 'bg-red-500/20', text: 'text-red-500' }
    };
    const c = config[level] || config.low;
    return <Badge className={`${c.bg} ${c.text} border-0`}>{level.toUpperCase()}</Badge>;
  };

  const years = [];
  for (let y = new Date().getFullYear(); y >= 2020; y--) {
    years.push(y.toString());
  }

  const totalReports = reports.length;
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + (r.scores?.overallScore || 0), 0) / reports.length)
    : 0;
  const criticalNotifications = reports.reduce((sum, r) =>
    sum + (r.notifications?.filter(n => n.type === 'critical').length || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            AI Executive Report
          </h1>
          <p className="text-muted-foreground mt-1">
            Miesięczne raporty wykonawcze z analizą AI
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
                <Sparkles className="w-4 h-4 mr-2" />
                Generuj raport
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generuj AI Executive Report</DialogTitle>
                <DialogDescription>
                  Wybierz miesiąc i rok dla którego chcesz wygenerować raport wykonawczy AI
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
                      <Brain className="w-4 h-4 mr-2" />
                    )}
                    Generuj AI Raport
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
                <p className="text-xs text-muted-foreground">Raportów AI</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-full">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgScore}/100</p>
                <p className="text-xs text-muted-foreground">Średni wynik</p>
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
                <p className="text-2xl font-bold text-foreground">{reports.filter(r => r.scores?.businessGrowth && r.scores.businessGrowth >= 60).length}</p>
                <p className="text-xs text-muted-foreground">Dobry wzrost</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{criticalNotifications}</p>
                <p className="text-xs text-muted-foreground">Krytycznych alertów</p>
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
              <CardTitle className="text-lg text-foreground">Lista raportów wykonawczych</CardTitle>
              <CardDescription>
                AI analizy całego przedsiębiorstwa
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
          ) : loadError ? (
            <div className="p-6"><PanelError message={loadError} onRetry={fetchReports} /></div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Brain className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Brak raportów AI za wybrany rok</p>
              <Button onClick={() => setShowGenerateDialog(true)} variant="outline" className="mt-4">
                <Sparkles className="w-4 h-4 mr-2" />
                Wygeneruj pierwszy raport
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Okres</TableHead>
                  <TableHead>Ocena AI</TableHead>
                  <TableHead>Finanse</TableHead>
                  <TableHead>Produkcja</TableHead>
                  <TableHead>Wzrost</TableHead>
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
                        <span className={`text-xl font-bold ${getScoreColor(report.scores?.overallScore || 0)}`}>
                          {report.scores?.overallScore || 0}
                        </span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={getScoreColor(report.scores?.financialHealth || 0)}>
                        {report.scores?.financialHealth || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getScoreColor(report.scores?.productionEfficiency || 0)}>
                        {report.scores?.productionEfficiency || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getScoreColor(report.scores?.businessGrowth || 0)}>
                        {report.scores?.businessGrowth || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(report.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(report.generated_at), 'dd.MM.yyyy')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewReport(report.id)}
                          title="Zobacz"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => archiveReport(report.id)}
                          title="Archiwizuj"
                        >
                          <Archive className="w-4 h-4" />
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
            <Brain className="w-5 h-5 text-primary" />
            Jak działa AI Executive Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            AI analizuje całe przedsiębiorstwo jak doświadczony CEO, CFO i kierownik produkcji.
            Każdy raport zawiera naturalne podsumowania, oceny punktowe i konkretne rekomendacje.
          </p>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
              <Target className="w-5 h-5 text-green-500 mb-2" />
              <p className="text-sm font-medium">Oceny firma (0-100)</p>
              <p className="text-xs text-muted-foreground">Finanse, Produkcja, Magazyn, Klienci, Wzrost</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Zap className="w-5 h-5 text-blue-500 mb-2" />
              <p className="text-sm font-medium">Inteligentne wnioski</p>
              <p className="text-xs text-muted-foreground">Analiza przyczyn, nie tylko liczb</p>
            </div>
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <Shield className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-medium">Analiza ryzyka</p>
              <p className="text-xs text-muted-foreground">Prognozowanie problemów</p>
            </div>
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="w-5 h-5 text-yellow-500 mb-2" />
              <p className="text-sm font-medium">Alerty realtime</p>
              <p className="text-xs text-muted-foreground">Niskie stany, awarie, spadki</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* View Report Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              {viewingReport?.title}
            </DialogTitle>
            <DialogDescription>
              {viewingReport && format(new Date(viewingReport.report_month), 'MMMM yyyy', { locale: pl })}
            </DialogDescription>
          </DialogHeader>

          {viewingReport && (
            <div id="report-content" className="space-y-6 pt-4">
              {/* Scores */}
              {viewingReport.scores && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Oceny przedmiotowe
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-card border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Zdrowie finansowe</span>
                        <span className={`font-bold ${getScoreColor(viewingReport.scores.financialHealth)}`}>
                          {viewingReport.scores.financialHealth}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.financialHealth)}`}
                          style={{ width: `${viewingReport.scores.financialHealth}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Efektywność produkcji</span>
                        <span className={`font-bold ${getScoreColor(viewingReport.scores.productionEfficiency)}`}>
                          {viewingReport.scores.productionEfficiency}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.productionEfficiency)}`}
                          style={{ width: `${viewingReport.scores.productionEfficiency}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Zarządzanie magazynem</span>
                        <span className={`font-bold ${getScoreColor(viewingReport.scores.warehouseManagement)}`}>
                          {viewingReport.scores.warehouseManagement}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.warehouseManagement)}`}
                          style={{ width: `${viewingReport.scores.warehouseManagement}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Satysfakcja klientów</span>
                        <span className={`font-bold ${getScoreColor(viewingReport.scores.customerSatisfaction)}`}>
                          {viewingReport.scores.customerSatisfaction}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.customerSatisfaction)}`}
                          style={{ width: `${viewingReport.scores.customerSatisfaction}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-card border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Wzrost biznesowy</span>
                        <span className={`font-bold ${getScoreColor(viewingReport.scores.businessGrowth)}`}>
                          {viewingReport.scores.businessGrowth}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.businessGrowth)}`}
                          style={{ width: `${viewingReport.scores.businessGrowth}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">OCENA OGÓLNA</span>
                        <span className={`text-2xl font-bold ${getScoreColor(viewingReport.scores.overallScore)}`}>
                          {viewingReport.scores.overallScore}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${getScoreBarColor(viewingReport.scores.overallScore)}`}
                          style={{ width: `${viewingReport.scores.overallScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {viewingReport.notifications && viewingReport.notifications.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    Alerty AI
                  </h3>
                  <div className="space-y-2">
                    {viewingReport.notifications.map((n, i) => (
                      <div key={i} className={`p-3 rounded-lg flex items-start gap-3 ${
                        n.type === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                        n.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                        n.type === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                        'bg-blue-500/10 border border-blue-500/20'
                      }`}>
                        {n.type === 'critical' && <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />}
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                        {n.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />}
                        {n.type === 'info' && <FileText className="w-4 h-4 text-blue-500 mt-0.5" />}
                        <div>
                          <p className="font-medium text-sm">{n.title}</p>
                          <p className="text-xs text-muted-foreground">{n.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {viewingReport.insights && viewingReport.insights.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-blue-500" />
                    Inteligentne wnioski
                  </h3>
                  <div className="space-y-2">
                    {viewingReport.insights.map((insight, i) => (
                      <div key={i} className={`p-3 rounded-lg ${
                        insight.type === 'positive' ? 'bg-green-500/10' :
                        insight.type === 'critical' ? 'bg-red-500/10' :
                        insight.type === 'warning' ? 'bg-yellow-500/10' :
                        'bg-blue-500/10'
                      }`}>
                        <p className="font-medium text-sm flex items-center gap-2">
                          {insight.type === 'positive' && <TrendingUp className="w-4 h-4 text-green-500" />}
                          {insight.type === 'critical' && <TrendingDown className="w-4 h-4 text-red-500" />}
                          {insight.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                          {insight.type === 'info' && <BarChart3 className="w-4 h-4 text-blue-500" />}
                          {insight.title}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                        {insight.recommendation && (
                          <p className="text-xs text-primary mt-2 pl-6">{insight.recommendation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {viewingReport.recommendations && viewingReport.recommendations.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-500" />
                    Rekomendacje
                  </h3>
                  <div className="space-y-2">
                    {viewingReport.recommendations.map((r, i) => (
                      <div key={i} className="p-3 rounded-lg bg-card border">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{r.action}</p>
                            <p className="text-xs text-muted-foreground mt-1">{r.details}</p>
                          </div>
                          <Badge variant={r.priority === 'high' ? 'destructive' : 'outline'} className="ml-2">
                            {r.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-green-500 mt-2">{r.expectedImpact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {viewingReport.risks && viewingReport.risks.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-orange-500" />
                    Analiza ryzyka
                  </h3>
                  <div className="space-y-2">
                    {viewingReport.risks.map((risk, i) => (
                      <div key={i} className="p-3 rounded-lg bg-card border">
                        <div className="flex items-center gap-2 mb-2">
                          {getRiskBadge(risk.level)}
                          <span className="font-medium text-sm">{risk.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{risk.description}</p>
                        <div className="mt-2 pt-2 border-t text-xs">
                          <p className="text-muted-foreground"><strong>Wpływ:</strong> {risk.impact}</p>
                          <p className="text-green-500"><strong>Mitigacja:</strong> {risk.mitigation}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forecast */}
              {viewingReport.forecast && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Prognoza na następny miesiąc
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-card border text-center">
                      <DollarSign className="w-6 h-6 mx-auto text-green-500 mb-2" />
                      <p className="text-2xl font-bold">{viewingReport.forecast.revenue.value} PLN</p>
                      <p className="text-xs text-muted-foreground">Przychód ({viewingReport.forecast.revenue.confidence}% pewności)</p>
                    </div>
                    <div className="p-4 rounded-xl bg-card border text-center">
                      <TrendingUp className="w-6 h-6 mx-auto text-primary mb-2" />
                      <p className="text-2xl font-bold">{viewingReport.forecast.profit.value} PLN</p>
                      <p className="text-xs text-muted-foreground">Zysk ({viewingReport.forecast.profit.confidence}% pewności)</p>
                    </div>
                    <div className="p-4 rounded-xl bg-card border text-center">
                      <Package className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                      <p className="text-2xl font-bold">{viewingReport.forecast.orders.value}</p>
                      <p className="text-xs text-muted-foreground">Zamówienia ({viewingReport.forecast.orders.confidence}% pewności)</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Podsumowanie AI
                </h3>
                <div className="p-4 rounded-xl bg-card border whitespace-pre-wrap text-sm">
                  {viewingReport.summary}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={printReport}>
                  <Printer className="w-4 h-4 mr-2" />
                  Drukuj
                </Button>
                <Button variant="outline" onClick={() => setShowViewDialog(false)}>
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
