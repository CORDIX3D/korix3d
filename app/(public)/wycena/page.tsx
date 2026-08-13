'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  FileBox,
  Settings2,
  Truck,
  CheckCircle2,
  Loader2,
  X,
  AlertCircle,
  Info,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { toast } from 'sonner';
import { parseDeliveryOptions, type DeliveryOption } from '@/lib/shipping';
import type { PublicFilament } from '@/lib/public-filament';
import { PUBLIC_MATERIAL_COLUMNS, type PublicMaterial } from '@/lib/public-material';
import {
  formatQuotePrice as formatPrice,
  infillOptions,
  priorityOptions,
  quoteSchema,
  serviceNotes,
  slicingProgress,
  type AutomaticQuote,
  type QuoteColor,
  type QuoteFormValues,
} from '@/lib/quote-form';

function QuotePageContent() {
  const searchParams = useSearchParams();
  const requestedMaterialId = searchParams.get('material');
  const requestedService = searchParams.get('usluga');
  const { user } = useAuth();
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [colors, setColors] = useState<QuoteColor[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<PublicMaterial | null>(null);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [colorsLoading, setColorsLoading] = useState(false);
  const [colorsError, setColorsError] = useState('');
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [deliveryError, setDeliveryError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [submitted, setSubmitted] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState('');
  const [submittedOrderId, setSubmittedOrderId] = useState('');
  const [automaticQuote, setAutomaticQuote] = useState<AutomaticQuote | null>(null);
  const [quotePollingError, setQuotePollingError] = useState('');
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const [paying, setPaying] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      infill: '20',
      quantity: 1,
      priority: 'standard',
      delivery_type: '',
      notes: requestedService ? serviceNotes[requestedService] || '' : '',
    },
  });

  const watchMaterial = watch('material_id');
  const watchPriority = watch('priority');
  const watchDelivery = watch('delivery_type');
  const watchQuantity = watch('quantity');

  const fetchMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    setMaterialsError('');

    try {
      const { data, error } = await supabase
        .from('materials')
        .select(PUBLIC_MATERIAL_COLUMNS)
        .eq('available', true)
        .order('name');

      if (error) {
        setMaterials([]);
        setMaterialsError('Nie udało się pobrać listy materiałów. Spróbuj odświeżyć stronę albo skontaktuj się z nami.');
      } else {
        setMaterials(data || []);
      }
    } catch {
      setMaterials([]);
      setMaterialsError('Nie udało się pobrać listy materiałów. Spróbuj odświeżyć stronę albo skontaktuj się z nami.');
    } finally {
      setMaterialsLoading(false);
    }
  }, []);

  const fetchColors = useCallback(async (materialId: string) => {
    setColors([]);
    setValue('color', '');
    setColorsLoading(true);
    setColorsError('');

    try {
      const response = await fetch(
        `/api/public/filaments?material_id=${encodeURIComponent(materialId)}`,
        { cache: 'no-store' }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || 'Nie udało się pobrać kolorów.');

      setColors(((payload?.filaments || []) as PublicFilament[]).map((filament) => ({
          id: filament.id,
          name: `${filament.color}${filament.brand ? ` (${filament.brand})` : ''}`,
          hex: filament.color_hex || '#ffffff',
      })));
    } catch {
      setColors([]);
      setColorsError('Nie udało się pobrać kolorów dla wybranego materiału.');
    } finally {
      setColorsLoading(false);
    }
  }, [setValue]);

  const fetchDeliveryOptions = useCallback(async () => {
    setDeliveryLoading(true);
    setDeliveryError('');

    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, label, value')
        .eq('category', 'shipping')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const options = parseDeliveryOptions(data || []);
      setDeliveryOptions(options);
      if (options.length === 0) {
        setDeliveryError('Brak skonfigurowanych metod dostawy. Skontaktuj się z nami przed wysłaniem wyceny.');
      }
    } catch {
      setDeliveryOptions([]);
      setDeliveryError('Nie udało się pobrać metod dostawy z panelu administratora. Spróbuj ponownie.');
    } finally {
      setDeliveryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMaterials();
    fetchDeliveryOptions();
  }, [fetchDeliveryOptions, fetchMaterials]);

  useEffect(() => {
    if (watchMaterial) {
      fetchColors(watchMaterial);
      const mat = materials.find((m) => m.id === watchMaterial);
      setSelectedMaterial(mat ?? null);
    }
  }, [fetchColors, watchMaterial, materials]);

  useEffect(() => {
    if (
      !materialsLoading
      && !watchMaterial
      && requestedMaterialId
      && materials.some((material) => material.id === requestedMaterialId)
    ) {
      setValue('material_id', requestedMaterialId);
    }
  }, [materials, materialsLoading, requestedMaterialId, setValue, watchMaterial]);

  useEffect(() => {
    if (deliveryOptions.length > 0 && !deliveryOptions.some((option) => option.value === watchDelivery)) {
      setValue('delivery_type', deliveryOptions[0].value);
    }
  }, [deliveryOptions, setValue, watchDelivery]);

  useEffect(() => {
    if (!submittedOrderId) return;

    let active = true;
    let timeoutId: number | undefined;

    const checkQuote = async () => {
      try {
        const response = await fetch(`/api/public/quote/${submittedOrderId}/status`, {
          cache: 'no-store',
        });
        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || 'Nie udało się pobrać wyniku wyceny.');
        }
        if (!active) return;

        setAutomaticQuote(result as AutomaticQuote);
        setQuotePollingError('');
        if (result.state === 'ready' || result.state === 'manual_review') return;
      } catch (error) {
        if (!active) return;
        setQuotePollingError(
          error instanceof Error ? error.message : 'Nie udało się pobrać wyniku wyceny.'
        );
      }

      if (active) timeoutId = window.setTimeout(checkQuote, 2500);
    };

    void checkQuote();
    return () => {
      active = false;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [submittedOrderId, quoteRefreshKey]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validExtensions = ['.stl', '.step', '.stp', '.obj', '.3mf'];
    const maxSize = 50 * 1024 * 1024; // 50MB
    const maxTotalSize = 200 * 1024 * 1024; // 200MB

    const validFiles: File[] = [];
    const existingFiles = new Set(uploadedFiles.map((file) => `${file.name}:${file.size}`));
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validExtensions.includes(ext)) {
        toast.error('Nieprawidłowy format pliku', {
          description: `Plik ${file.name} ma nieprawidłowy format. Akceptowane: STL, STEP, OBJ, 3MF`,
        });
        continue;
      }
      if (file.size > maxSize) {
        toast.error('Plik za duży', {
          description: `Plik ${file.name} przekracza limit 50MB`,
        });
        continue;
      }
      if (existingFiles.has(`${file.name}:${file.size}`)) {
        toast.info('Plik został już dodany', { description: file.name });
        continue;
      }
      if (uploadedFiles.length + validFiles.length >= 10) {
        toast.error('Osiągnięto limit plików', { description: 'Do jednej wyceny możesz dodać maksymalnie 10 plików.' });
        break;
      }
      const totalSize = [...uploadedFiles, ...validFiles].reduce((sum, item) => sum + item.size, 0);
      if (totalSize + file.size > maxTotalSize) {
        toast.error('Przekroczono łączny limit', { description: 'Wszystkie pliki jednej wyceny mogą zajmować maksymalnie 200 MB.' });
        break;
      }
      validFiles.push(file);
      existingFiles.add(`${file.name}:${file.size}`);
    }

    setUploadedFiles((prev) => [...prev, ...validFiles]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    if (submitting) return;
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: QuoteFormValues) => {
    if (submitting) return;

    if (
      deliveryLoading
      || deliveryError
      || !deliveryOptions.some((option) => option.value === data.delivery_type)
    ) {
      toast.error('Konfiguracja wyceny jest niedostępna', {
        description: 'Odśwież metody dostawy, a następnie spróbuj ponownie.',
      });
      return;
    }

    if (!user) {
      toast.error('Zaloguj się', { description: 'Konto jest wymagane do wysłania i śledzenia wyceny.' });
      return;
    }
    if (uploadedFiles.length === 0) {
      toast.error('Dodaj pliki', {
        description: 'Musisz dodać co najmniej jeden plik 3D',
      });
      return;
    }

    setSubmitting(true);
    setAutomaticQuote(null);
    setQuotePollingError('');
    setUploadProgress({ completed: 0, total: uploadedFiles.length });
    const orderId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      const deliveryLabel = deliveryOptions.find((option) => option.value === data.delivery_type)?.label;
      const configurationNotes = [
        `Wypełnienie: ${data.infill}%`,
        `Dostawa: ${deliveryLabel ?? data.delivery_type}`,
        data.notes,
      ].filter(Boolean).join('\n');

      // Najpierw tworzymy pusty rekord. Polityka Storage pozwala wysyłać pliki
      // wyłącznie do istniejącego zamówienia należącego do użytkownika.
      const createResponse = await fetch('/api/public/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          order_id: orderId,
          material_id: data.material_id,
          filament_id: data.color,
          infill_percent: Number(data.infill),
          quantity: data.quantity,
          priority: data.priority,
          delivery_type: data.delivery_type,
          notes: configurationNotes,
        }),
      });

      const createdOrder = await createResponse.json().catch(() => null);

      if (!createResponse.ok) {
        throw new Error(createdOrder?.error || 'Nie udało się utworzyć zlecenia.');
      }

      const storedFiles = [];
      for (let index = 0; index < uploadedFiles.length; index += 1) {
        const file = uploadedFiles[index];
        const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
        const baseName = file.name
          .replace(/\.[^.]+$/, '')
          .normalize('NFKD')
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 80) || 'model';
        const storagePath = `${user.id}/${orderId}/${index + 1}-${baseName}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            contentType: 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) throw new Error(`Nie udało się przesłać pliku ${file.name}: ${uploadError.message}`);
        uploadedPaths.push(storagePath);
        storedFiles.push({
          name: file.name,
          size: file.size,
          type: extension,
          bucket: 'quote-files',
          storage_path: storagePath,
        });
        setUploadProgress({ completed: index + 1, total: uploadedFiles.length });
      }

      const finalizeResponse = await fetch('/api/public/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize',
          order_id: orderId,
          files: storedFiles,
        }),
      });

      const finalized = await finalizeResponse.json().catch(() => null);

      if (!finalizeResponse.ok) {
        throw new Error(finalized?.error || 'Nie udało się przypisać plików do zamówienia.');
      }

      toast.success('Zlecenie przyjęte', {
        description: 'Creality Print rozpoczął automatyczne obliczanie ceny',
      });

      setSubmittedOrderNumber(createdOrder?.order_number || orderId.slice(0, 8).toUpperCase());
      setSubmittedOrderId(orderId);
      reset();
      setUploadedFiles([]);
      setColors([]);
      setSelectedMaterial(null);
      setStep(1);
      setSubmitted(true);
    } catch (error) {
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('quote-files').remove(uploadedPaths);
        } catch {
          // Cleanup failure should not hide the original submission error.
        }
      }
      try {
        await fetch('/api/public/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'discard', order_id: orderId }),
        });
      } catch {
        // Cleanup failure should not hide the original submission error.
      }
      toast.error('Błąd', {
        description: error instanceof Error ? error.message : 'Wystąpił błąd podczas wysyłania zlecenia',
      });
    } finally {
      setSubmitting(false);
      setUploadProgress({ completed: 0, total: 0 });
    }
  };

  const startQuotePayment = async () => {
    if (!submittedOrderId || paying) return;
    setPaying(true);
    try {
      const response = await fetch('/api/stripe/create-quote-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: submittedOrderId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error === 'stripe_not_configured'
          ? 'Płatności są chwilowo niedostępne. Spróbuj ponownie później.'
          : result?.error || 'Nie udało się otworzyć płatności.';
        toast.error(message);
        return;
      }
      if (result?.url) {
        window.location.assign(result.url);
        return;
      }
      if (result?.paid && result?.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      toast.error('Stripe nie zwrócił adresu płatności.');
    } catch {
      toast.error('Nie udało się połączyć ze Stripe.');
    } finally {
      setPaying(false);
    }
  };

  if (submitted) {
    const quoteReady = automaticQuote?.state === 'ready' && Number(automaticQuote.final_price || 0) > 0;
    const manualReview = automaticQuote?.state === 'manual_review';
    const currentProgress = slicingProgress[automaticQuote?.slicing_status || 'not_started']
      || slicingProgress.not_started;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="bg-card border-border max-w-lg w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
              quoteReady ? 'bg-green-500/20' : manualReview ? 'bg-yellow-500/20' : 'bg-primary/15'
            }`}>
              {quoteReady ? (
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              ) : manualReview ? (
                <AlertCircle className="w-10 h-10 text-yellow-500" />
              ) : (
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {quoteReady ? 'Twoja wycena jest gotowa' : manualReview ? 'Potrzebna dodatkowa kontrola' : 'Obliczamy dokładną cenę'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {quoteReady
                ? 'Creality Print zakończył analizę modelu, a kalkulator uwzględnił wszystkie ustawione koszty.'
                : manualReview
                  ? 'Model wymaga ręcznego sprawdzenia. Zlecenie pozostaje zapisane i pojawi się w panelu klienta.'
                  : 'Creality Print analizuje model. Cena pojawi się tutaj automatycznie po obliczeniu czasu i zużycia filamentu.'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Numer zlecenia: <strong className="text-foreground">{submittedOrderNumber}</strong>
            </p>

            {!quoteReady && !manualReview && (
              <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{currentProgress.label}</span>
                  <span className="text-muted-foreground">{currentProgress.value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${currentProgress.value}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nie musisz odświeżać strony. Gotowa cena pojawi się tutaj automatycznie.
                </p>
              </div>
            )}

            {quoteReady && (
              <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-5">
                <p className="text-sm text-muted-foreground">Cena końcowa brutto</p>
                <p className="mt-1 text-4xl font-bold text-primary">
                  {formatPrice(automaticQuote.final_price)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Netto: <span className="font-semibold text-foreground">{formatPrice(automaticQuote.net_price)}</span>
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-background/60 p-3">
                    <p className="text-muted-foreground">Czas druku</p>
                    <p className="font-semibold">{Number(automaticQuote.printing_time_hours || 0).toFixed(2)} h</p>
                  </div>
                  <div className="rounded-lg bg-background/60 p-3">
                    <p className="text-muted-foreground">Waga produktu</p>
                    <p className="font-semibold">{Number(automaticQuote.filament_used_grams || 0).toFixed(2)} g</p>
                  </div>
                </div>
              </div>
            )}

            {quotePollingError && !manualReview && !quoteReady && (
              <div className="mb-5 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3 text-sm text-muted-foreground">
                <p>{quotePollingError} Ponawiamy sprawdzanie automatycznie.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setQuoteRefreshKey((value) => value + 1)}
                >
                  Sprawdź cenę teraz
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={quoteReady
                  ? startQuotePayment
                  : () => (window.location.href = `/panel/zamowienia/${submittedOrderId}`)}
                disabled={paying}
                className="flex-1 bg-gradient-primary hover:shadow-glow transition-shadow"
              >
                {paying
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Otwieranie płatności...</>
                  : quoteReady
                    ? <><CreditCard className="mr-2 h-4 w-4" />Zapłać przez Stripe</>
                    : 'Otwórz zlecenie'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setSubmittedOrderId('');
                  setAutomaticQuote(null);
                  setQuotePollingError('');
                  setQuoteRefreshKey(0);
                }}
                className="flex-1"
              >
                Nowa wycena
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background */}
      <div className="absolute inset-0 bg-3d-grid opacity-30"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent"></div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Wyceń wydruk 3D
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Prześlij swój model, wybierz parametry i otrzymaj bezpłatną, indywidualną wycenę
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {[
            { num: 1, label: 'Pliki' },
            { num: 2, label: 'Materiał' },
            { num: 3, label: 'Parametry' },
            { num: 4, label: 'Podsumowanie' },
          ].map((item, index) => (
            <div key={item.num} className="flex items-center">
              <button
                onClick={() => item.num <= step + 1 && setStep(item.num)}
                disabled={submitting || item.num > step + 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                  step === item.num
                    ? 'bg-primary text-white'
                    : step > item.num
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center text-sm font-bold">
                  {step > item.num ? <CheckCircle2 className="w-5 h-5" /> : item.num}
                </span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
              {index < 3 && (
                <div className={`w-8 sm:w-16 h-0.5 ${
                  step > item.num ? 'bg-primary' : 'bg-border'
                }`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step 1: File Upload */}
          {step === 1 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBox className="w-5 h-5 text-primary" />
                  Prześlij pliki 3D
                </CardTitle>
                <CardDescription>
                  Akceptowane formaty: STL, STEP, OBJ, 3MF. Maksymalny rozmiar: 50MB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    accept=".stl,.step,.stp,.obj,.3mf"
                    className="hidden"
                    disabled={submitting}
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-lg font-medium text-foreground mb-2">
                      Przeciągnij pliki lub kliknij aby przesłać
                    </p>
                    <p className="text-sm text-muted-foreground">
                      STL, STEP, OBJ, 3MF • max 50MB
                    </p>
                  </label>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Przesłane pliki:</h4>
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-secondary rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileBox className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{file.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          disabled={submitting}
                          className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {uploadedFiles.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Dodaj co najmniej jeden plik</p>
                      <p className="text-sm text-muted-foreground">
                        Musisz przesłać plik 3D aby kontynuować
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={submitting || uploadedFiles.length === 0}
                    className="bg-gradient-primary hover:shadow-glow"
                  >
                    Dalej
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Material Selection */}
          {step === 2 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Wybierz materiał i kolor
                </CardTitle>
                <CardDescription>
                  Wybierz materiał odpowiedni dla Twojego projektu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Material Selection */}
                <div className="space-y-2">
                  <label className="form-label">Materiał</label>
                  {materialsLoading ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      Ładowanie dostępnych materiałów...
                    </div>
                  ) : materialsError ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                      <p className="font-medium text-destructive">Nie można pobrać materiałów</p>
                      <p className="mt-1 text-sm text-muted-foreground">{materialsError}</p>
                      <Button type="button" variant="outline" size="sm" onClick={fetchMaterials} className="mt-3">
                        Spróbuj ponownie
                      </Button>
                    </div>
                  ) : materials.length === 0 ? (
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                      <p className="font-medium text-foreground">Brak dostępnych materiałów</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Aktualnie nie ma aktywnych materiałów do wyceny. Napisz do nas przez kontakt, a dobierzemy materiał ręcznie.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {materials.map((material) => (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => setValue('material_id', material.id)}
                          className={`p-4 rounded-xl border text-left transition-all ${
                            watchMaterial === material.id
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-foreground">
                              {material.name}
                            </span>
                            <span className="text-xs text-primary font-medium">
                              wybierz kolor dalej
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {material.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.material_id && (
                    <p className="text-sm text-destructive">{errors.material_id.message}</p>
                  )}
                </div>

                {/* Color Selection */}
                {watchMaterial && (
                  <div className="space-y-2">
                    <label className="form-label">Kolor</label>
                    {colorsLoading ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        Ładowanie kolorów...
                      </div>
                    ) : colorsError ? (
                      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                        <p className="font-medium text-destructive">Nie można pobrać kolorów</p>
                        <p className="mt-1 text-sm text-muted-foreground">{colorsError}</p>
                        <Button type="button" variant="outline" size="sm" onClick={() => fetchColors(watchMaterial)} className="mt-3">
                          Spróbuj ponownie
                        </Button>
                      </div>
                    ) : colors.length === 0 ? (
                      <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                        <p className="font-medium text-foreground">Brak kolorów dla tego materiału</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Wybierz inny materiał albo skontaktuj się z nami — sprawdzimy dostępność koloru ręcznie.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                        {colors.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            onClick={() => setValue('color', color.id)}
                            className={`p-2 rounded-xl border transition-all flex flex-col items-center ${
                              watch('color') === color.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50'
                            }`}
                          >
                            <div
                              className="w-10 h-10 rounded-lg mb-2 border border-border"
                              style={{ backgroundColor: color.hex }}
                            />
                            <span className="text-xs text-foreground">{color.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.color && (
                      <p className="text-sm text-destructive">{errors.color.message}</p>
                    )}
                  </div>
                )}

                {/* Material Info */}
                {selectedMaterial && (
                  <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground mb-1">
                          {selectedMaterial.name}
                        </h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>To jest typ materiału. Kolor, cena i dostępność są pobierane z konkretnych filamentów w magazynie.</p>
                          <p>Dokładne parametry druku potwierdzimy po analizie przesłanego pliku.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep(1)}>
                    Wstecz
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={submitting || !watchMaterial || !watch('color') || materialsLoading || colorsLoading || Boolean(materialsError) || Boolean(colorsError)}
                    className="bg-gradient-primary hover:shadow-glow"
                  >
                    Dalej
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Parameters */}
          {step === 3 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Parametry wydruku
                </CardTitle>
                <CardDescription>
                  Skonfiguruj szczegóły wydruku
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Infill */}
                <div className="space-y-2">
                  <label className="form-label">Wypełnienie (Infill)</label>
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    {infillOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue('infill', option.value as any)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          watch('infill') === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className="font-semibold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <label className="form-label">Ilość sztuk</label>
                  <Input
                    type="number"
                    {...register('quantity', { valueAsNumber: true })}
                    min={1}
                    max={1000}
                    className="h-12 bg-secondary border-border w-32"
                  />
                  {errors.quantity && (
                    <p className="text-sm text-destructive">{errors.quantity.message}</p>
                  )}
                </div>

                {/* Priority */}
                <div className="space-y-2">
                  <label className="form-label">Priorytet realizacji</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {priorityOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue('priority', option.value as any)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          watchPriority === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-foreground">{option.label}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="form-label">Dodatkowe uwagi</label>
                  <Textarea
                    {...register('notes')}
                    placeholder="Dodatkowe informacje o projekcie..."
                    maxLength={2000}
                    className="bg-secondary border-border min-h-[100px]"
                  />
                  {errors.notes && (
                    <p className="text-sm text-destructive">{errors.notes.message}</p>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep(2)}>
                    Wstecz
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(4)}
                    disabled={submitting}
                    className="bg-gradient-primary hover:shadow-glow"
                  >
                    Dalej
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Summary & Delivery */}
          {step === 4 && (
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  Podsumowanie
                </CardTitle>
                <CardDescription>
                  Sprawdź szczegóły i wyślij zlecenie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Summary */}
                <div className="space-y-4">
                  <div className="p-4 bg-secondary rounded-xl">
                    <h4 className="text-sm font-medium text-muted-foreground mb-3">Pliki</h4>
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <FileBox className="w-4 h-4 text-primary" />
                          <span className="text-foreground">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-secondary rounded-xl">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Materiał
                      </h4>
                      <p className="text-foreground font-medium">
                        {selectedMaterial?.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {colors.find((c) => c.id === watch('color'))?.name}
                      </p>
                    </div>

                    <div className="p-4 bg-secondary rounded-xl">
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        Parametry
                      </h4>
                      <p className="text-foreground">Wypełnienie: {watch('infill')}%</p>
                      <p className="text-foreground">Ilość: {watchQuantity} szt.</p>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary rounded-xl">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Priorytet
                    </h4>
                    <p className="text-foreground capitalize">
                      {priorityOptions.find((p) => p.value === watchPriority)?.label}
                    </p>
                  </div>
                </div>

                {/* Delivery Method */}
                <div className="space-y-2">
                  <label className="form-label">Metoda dostawy</label>
                  {deliveryError && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      <p>{deliveryError}</p>
                      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={fetchDeliveryOptions} disabled={deliveryLoading}>
                        {deliveryLoading ? 'Pobieranie...' : 'Spróbuj ponownie'}
                      </Button>
                    </div>
                  )}
                  {deliveryLoading && !deliveryError && (
                    <div className="flex items-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Pobieranie aktualnych metod dostawy...
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {deliveryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue('delivery_type', option.value)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          watchDelivery === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className="font-semibold text-foreground">{option.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {deliveryLoading ? 'Ładowanie...' : option.price === 0 ? 'Gratis' : `${option.price.toFixed(2)} zł`}
                        </p>
                      </button>
                    ))}
                  </div>
                  {errors.delivery_type && (
                    <p className="text-sm text-destructive">{errors.delivery_type.message}</p>
                  )}
                </div>

                {/* Info Box */}
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">
                        Proces wyceny
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Po przesłaniu model zostanie automatycznie przeliczony przez Creality Print. Cena netto i brutto pojawi się na tym ekranie bez udziału administratora, od razu po zakończeniu analizy.
                        Termin realizacji potwierdzimy razem z wyceną. Wycena jest bezpłatna i niezobowiązująca.
                      </p>
                    </div>
                  </div>
                </div>

                {!user && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Nie jesteś zalogowany
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <a href="/logowanie?redirect=/wycena" className="text-primary hover:underline">
                            Zaloguj się
                          </a>{' '}
                          lub{' '}
                          <a href="/rejestracja" className="text-primary hover:underline">
                            zarejestruj
                          </a>{' '}
                          aby śledzić status zamówienia w panelu klienta.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {submitting && uploadProgress.total > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground">Przesyłanie modeli do bezpiecznego magazynu</span>
                      <span className="font-medium text-primary">{uploadProgress.completed}/{uploadProgress.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.round((uploadProgress.completed / uploadProgress.total) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Nie zamykaj strony do zakończenia wysyłania.</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep(3)}>
                    Wstecz
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !user || deliveryLoading || Boolean(deliveryError) || !deliveryOptions.some((option) => option.value === watchDelivery)}
                    className="bg-gradient-primary hover:shadow-glow min-w-[160px]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Wysyłanie...
                      </>
                    ) : (
                      user ? 'Oblicz dokładną cenę' : 'Zaloguj się, aby wycenić'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </div>
    </div>
  );
}

export default function QuotePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Ładowanie formularza wyceny" /></div>}>
      <QuotePageContent />
    </Suspense>
  );
}
