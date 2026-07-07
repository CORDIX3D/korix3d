'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  DollarSign,
  Truck,
  Percent,
  Mail,
  Save,
  RefreshCw,
  Building2,
  Globe,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { PanelError, PanelLoading } from '@/components/customer/panel-state';

interface SettingItem {
  id: string;
  key: string;
  value: string;
  label: string | null;
  category: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('category')
      .order('key');

    if (error) {
      setLoadError('Nie udało się pobrać ustawień z Supabase.');
    } else if (data) {
      setSettings(data as SettingItem[]);
      const formValues: Record<string, string> = {};
      (data as SettingItem[]).forEach((s) => {
        formValues[s.key] = s.value || '';
      });
      setFormData(formValues);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    let hasError = false;

    for (const [key, value] of Object.entries(formData)) {
      const { error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key);

      if (error) {
        console.error(`Error updating ${key}:`, error);
        hasError = true;
      }
    }

    if (hasError) {
      toast.error('Błąd', { description: 'Nie udało się zapisać niektórych ustawień' });
    } else {
      toast.success('Ustawienia zapisane');
    }
    setSaving(false);
  };

  const getSetting = (key: string): SettingItem | undefined => {
    return settings.find((s) => s.key === key);
  };

  const getValue = (key: string): string => {
    return formData[key] || '';
  };

  const setValue = (key: string, value: string) => {
    setFormData({ ...formData, [key]: value });
  };

  const pricingSettings = settings.filter((s) => s.category === 'pricing');
  const generalSettings = settings.filter((s) => s.category === 'general');
  const shippingSettings = settings.filter((s) => s.category === 'shipping');
  const socialSettings = settings.filter((s) => s.category === 'social');
  const seoSettings = settings.filter((s) => s.category === 'seo');

  if (loading) return <PanelLoading label="Pobieranie ustawień..." />;
  if (loadError) return <PanelError message={loadError} onRetry={fetchSettings} />;
  if (settings.length === 0) return <PanelError message="Tabela ustawień nie zawiera konfiguracji wymaganej przez panel." onRetry={fetchSettings} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Ustawienia
          </h1>
          <p className="text-muted-foreground mt-1">
            Konfiguracja systemu i parametrów
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

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary">
            <Building2 className="w-4 h-4 mr-2" />
            Firma
          </TabsTrigger>
          <TabsTrigger value="pricing" className="data-[state=active]:bg-primary">
            <DollarSign className="w-4 h-4 mr-2" />
            Cennik
          </TabsTrigger>
          <TabsTrigger value="shipping" className="data-[state=active]:bg-primary">
            <Truck className="w-4 h-4 mr-2" />
            Dostawa
          </TabsTrigger>
          <TabsTrigger value="social" className="data-[state=active]:bg-primary">
            <Globe className="w-4 h-4 mr-2" />
            Social
          </TabsTrigger>
          <TabsTrigger value="seo" className="data-[state=active]:bg-primary">
            <Globe className="w-4 h-4 mr-2" />
            SEO
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Dane firmy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="form-label">Nazwa firmy</label>
                  <Input
                    value={getValue('company_name')}
                    onChange={(e) => setValue('company_name', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Slogan</label>
                  <Input
                    value={getValue('company_slogan')}
                    onChange={(e) => setValue('company_slogan', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Email kontaktowy</label>
                  <Input
                    type="email"
                    value={getValue('company_email')}
                    onChange={(e) => setValue('company_email', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="form-label">Telefon</label>
                  <Input
                    value={getValue('company_phone')}
                    onChange={(e) => setValue('company_phone', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="form-label">Adres</label>
                  <Input
                    value={getValue('company_address')}
                    onChange={(e) => setValue('company_address', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Settings */}
        <TabsContent value="pricing">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary" />
                  Koszty druku
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="form-label">Koszt godziny druku (zł)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getValue('printing_hour_cost')}
                    onChange={(e) => setValue('printing_hour_cost', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stawka godzinowa za pracę drukarki
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="form-label">Koszt energii na godzinę (zł)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getValue('electricity_hour_cost')}
                    onChange={(e) => setValue('electricity_hour_cost', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label">Koszt utrzymania maszyny na godzinę (zł)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getValue('maintenance_hour_cost')}
                    onChange={(e) => setValue('maintenance_hour_cost', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label">Koszt opakowania (zł)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getValue('packaging_cost')}
                    onChange={(e) => setValue('packaging_cost', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground flex items-center gap-2">
                  <Percent className="w-5 h-5 text-primary" />
                  Marże i VAT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="form-label">Domyślna marża (%)</label>
                  <Input
                    type="number"
                    value={getValue('default_margin')}
                    onChange={(e) => setValue('default_margin', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label">Stawka VAT (%)</label>
                  <Input
                    type="number"
                    value={getValue('vat_rate')}
                    onChange={(e) => setValue('vat_rate', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="form-label">Minimalna wartość zamówienia (zł)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={getValue('minimum_order_value')}
                    onChange={(e) => setValue('minimum_order_value', e.target.value)}
                    className="h-11 bg-secondary border-border"
                  />
                </div>

                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    Te wartości są używane automatycznie w kalkulatorze wycen.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Shipping Settings */}
        <TabsContent value="shipping">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                Ustawienia dostawy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="form-label">
                  Kwota darmowej wysyłki (zł)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={getValue('free_shipping_threshold')}
                  onChange={(e) => setValue('free_shipping_threshold', e.target.value)}
                  className="h-11 bg-secondary border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Powyżej tej kwoty wysyłka jest bezpłatna
                </p>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  Metody dostawy i ich ceny konfiguruje się w sekcji{' '}
                  <a href="/admin/dostawa" className="text-primary hover:underline">
                    Dostawy
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Settings */}
        <TabsContent value="social">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Media społecznościowe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="form-label">Facebook</label>
                <Input
                  value={getValue('social_facebook')}
                  onChange={(e) => setValue('social_facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="h-11 bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="form-label">Instagram</label>
                <Input
                  value={getValue('social_instagram')}
                  onChange={(e) => setValue('social_instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="h-11 bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="form-label">LinkedIn</label>
                <Input
                  value={getValue('social_linkedin')}
                  onChange={(e) => setValue('social_linkedin', e.target.value)}
                  placeholder="https://linkedin.com/..."
                  className="h-11 bg-secondary border-border"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEO Settings */}
        <TabsContent value="seo">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Ustawienia SEO
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="form-label">Domyślny tytuł strony</label>
                <Input
                  value={getValue('seo_title')}
                  onChange={(e) => setValue('seo_title', e.target.value)}
                  className="h-11 bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="form-label">Domyślny opis meta</label>
                <Textarea
                  value={getValue('seo_description')}
                  onChange={(e) => setValue('seo_description', e.target.value)}
                  className="bg-secondary border-border min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Zalecana długość: 150-160 znaków
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
