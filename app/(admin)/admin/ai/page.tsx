'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bot,
  Save,
  RefreshCw,
  Settings2,
  BarChart3,
  MessageSquare,
  Sparkles,
  TrendingUp,
  Clock,
  Users,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface AISettingRecord {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  updated_at: string;
}

interface AILogRecord {
  id: string;
  query: string;
  response_time_ms: number;
  tokens_used: number;
  success: boolean;
  created_at: string;
  question_type: string | null;
  conversation_id?: string | null;
}

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  avgResponseTime: number;
  successRate: number;
  topQuestions: Array<{ query: string; count: number }>;
  dailyStats: Array<{ date: string; conversations: number; messages: number }>;
  recentLogs: AILogRecord[];
}


const SUGGESTED_PROMPTS = [
  "Jesteś KORIX AI - inteligentnym asystentem firmy KORIX3D, specjalizującej się w profesjonalnym druku 3D. Pomagasz klientom w wyborze materiałów, technologii, ustawień druku oraz odpowiedziach na pytania dotyczące produkcji. Odpowiadaj profesjonalnie, przyjaźnie i konkretnie. Używaj języka polskiego.",
  "Jesteś doświadczonym inżynierem sprzedaży w KORIX3D. Twoim zadaniem jest pomóc klientowi wybrać najlepsze rozwiązanie dla jego projektu druku 3D. Zadawaj pytania doprecyzowujące, doradzaj konkretne materiały i technologie.",
];

export default function AdminAIPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
    fetchAnalytics();
    // Funkcje są uruchamiane tylko przy wejściu do modułu; ręczne odświeżanie
    // korzysta z tych samych procedur przez przyciski poniżej.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('ai_settings')
      .select('*');

    if (error) {
      setLoadError('Nie udało się pobrać ustawień AI z Supabase.');
      toast.error('Błąd', { description: 'Nie udało się pobrać ustawień AI' });
    } else if (data) {
      const settingsMap: Record<string, string> = {};
      data.forEach((s: AISettingRecord) => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      setSettings(settingsMap);
    }
    setLoading(false);
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      // Fetch log counts
      const { count: totalLogs } = await supabase
        .from('ai_logs')
        .select('*', { count: 'exact', head: true });

      const { count: totalConversations } = await supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true });

      const { count: totalMessages } = await supabase
        .from('ai_messages')
        .select('*', { count: 'exact', head: true });

      // Fetch recent logs for analytics
      const { data: logsData } = await supabase
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: recentLogs } = await supabase
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsData) {
        const logs = logsData as AILogRecord[];
        const successCount = logs.filter((l) => l.success).length;
        const avgTime = logs.length > 0
          ? logs.reduce((sum, l) => sum + (l.response_time_ms || 0), 0) / logs.length
          : 0;

        // Group queries
        const queryCounts: Record<string, number> = {};
        logs.forEach((l) => {
          const query = l.query.toLowerCase().slice(0, 50);
          queryCounts[query] = (queryCounts[query] || 0) + 1;
        });

        const topQuestions = Object.entries(queryCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([query, count]) => ({ query, count }));

        // Daily stats (last 7 days)
        const dailyStats: Array<{ date: string; conversations: number; messages: number }> = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];

          const dayLogs = logs.filter((l) =>
            l.created_at.startsWith(dateStr)
          );

          dailyStats.push({
            date: dateStr.slice(5), // MM-DD
            conversations: new Set(dayLogs.map((l) => l.conversation_id).filter(Boolean)).size,
            messages: dayLogs.length
          });
        }

        setAnalytics({
          totalConversations: totalConversations || 0,
          totalMessages: totalMessages || 0,
          avgResponseTime: Math.round(avgTime),
          successRate: logsData.length > 0 ? Math.round((successCount / logsData.length) * 100) : 0,
          topQuestions: topQuestions as any,
          dailyStats,
          recentLogs: recentLogs || []
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
    setLoadingAnalytics(false);
  };

  const handleSave = async () => {
    setSaving(true);

    let hasError = false;

    for (const [key, value] of Object.entries(settings)) {
      const { error } = await supabase
        .from('ai_settings')
        .update({ setting_value: value })
        .eq('setting_key', key);

      if (error) {
        console.error(`Error updating ${key}:`, error);
        hasError = true;
      }
    }

    if (hasError) {
      toast.error('Błąd', { description: 'Nie udało się zapisać niektórych ustawień' });
    } else {
      toast.success('Ustawienia AI zapisane');
    }

    setSaving(false);
  };

  const getValue = (key: string): string => {
    return settings[key] || '';
  };

  const setValue = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  if (loading) return <PanelLoading label="Pobieranie konfiguracji AI..." />;
  if (loadError) return <PanelError message={loadError} onRetry={fetchSettings} />;
  if (Object.keys(settings).length === 0) return <PanelError message="Brak konfiguracji AI. Uzupełnij rekordy w tabeli ai_settings." onRetry={fetchSettings} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6A00] to-orange-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            KORIX AI
          </h1>
          <p className="text-muted-foreground mt-1">
            Konfiguracja i analiza asystenta AI
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSettings} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-primary hover:shadow-glow"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary">
            <Settings2 className="w-4 h-4 mr-2" />
            Ustawienia
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-primary">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analityka
          </TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:bg-primary">
            <MessageSquare className="w-4 h-4 mr-2" />
            Historia
          </TabsTrigger>
        </TabsList>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Enable/Disable */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Status asystenta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Asystent AI aktywny</Label>
                  <p className="text-sm text-muted-foreground">
                    Gdy wyłączone, przycisk asystenta nie będzie widoczny na stronie
                  </p>
                </div>
                <Switch
                  checked={getValue('enabled') !== 'false'}
                  onCheckedChange={(checked) => setValue('enabled', checked.toString())}
                />
              </div>
            </CardContent>
          </Card>
          {/* Free assistant mode */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Tryb bezpłatny
              </CardTitle>
              <CardDescription>
                Asystent odpowiada lokalnie na podstawie reguł oraz aktualnych danych z Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
                <p className="text-sm font-medium text-green-300">Brak kosztów zewnętrznego AI</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ten moduł nie łączy się z płatnymi modelami. Odpowiedzi bota bazują na stanie sklepu,
                  magazynie, materiałach, kolejce produkcyjnej i prostych regułach odpowiedzi.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* System Prompt */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                System Prompt
              </CardTitle>
              <CardDescription>
                Instrukcje dla asystenta AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={getValue('system_prompt')}
                onChange={(e) => setValue('system_prompt', e.target.value)}
                className="bg-secondary border-border min-h-[200px] font-mono text-sm"
                placeholder="Wpisz instrukcje dla asystenta..."
              />

              <div className="space-y-2">
                <Label className="text-sm">Przykładowe prompty:</Label>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => setValue('system_prompt', prompt)}
                      className="text-xs"
                    >
                      Użyj przykładu {i + 1}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Greeting Message */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Wiadomość powitalna
              </CardTitle>
              <CardDescription>
                Pierwsza wiadomość wyświetlana po otwarciu czatu
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={getValue('greeting')}
                onChange={(e) => setValue('greeting', e.target.value)}
                className="bg-secondary border-border min-h-[80px]"
                placeholder="Witaj! Jestem KORIX AI..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-full">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalConversations || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Konwersacje</p>
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
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.totalMessages || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Wiadomości</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-full">
                    <Clock className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatTime(analytics?.avgResponseTime || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Śr. czas odp.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-full">
                    <CheckCircle className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {analytics?.successRate || 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Skuteczność</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  Aktywność (ostatnie 7 dni)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics?.dailyStats && (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={analytics.dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="date" stroke="#666" />
                      <YAxis stroke="#666" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="messages"
                        stroke="#FF6A00"
                        fill="#FF6A00"
                        fillOpacity={0.2}
                        name="Wiadomości"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">
                  Najczęstsze pytania
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-secondary rounded-lg"
                    >
                      <span className="text-sm text-foreground truncate max-w-[200px]">
                        {q.query}...
                      </span>
                      <span className="text-sm text-primary font-semibold">
                        {q.count}x
                      </span>
                    </div>
                  ))}
                  {(!analytics?.topQuestions || analytics.topQuestions.length === 0) && (
                    <p className="text-center text-muted-foreground py-8">
                      Brak danych
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">
                Ostatnie zapytania
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics?.recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 bg-secondary rounded-xl border border-border"
                  >
                    <div className="flex-shrink-0">
                      {log.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {log.query}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>
                          {new Date(log.created_at).toLocaleString('pl-PL')}
                        </span>
                        <span>
                          {formatTime(log.response_time_ms || 0)}
                        </span>
                        {log.tokens_used && (
                          <span>{log.tokens_used} tokenów</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {(!analytics?.recentLogs || analytics.recentLogs.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    Brak historii zapytań
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
