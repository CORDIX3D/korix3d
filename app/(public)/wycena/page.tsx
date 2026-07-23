'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers';
import { toast } from 'sonner';

const quoteSchema = z.object({
  material_id: z.string().min(1, 'Wybierz materiał'),
  color: z.string().min(1, 'Wybierz kolor'),
  infill: z.enum(['10', '20', '30', '50', '80', '100']),
  quantity: z.number({ invalid_type_error: 'Podaj liczbę sztuk' }).int('Ilość musi być liczbą całkowitą').min(1, 'Minimalna ilość to 1').max(1000, 'Maksymalna ilość to 1000'),
  priority: z.enum(['standard', 'express', 'urgent']),
  notes: z.string().trim().max(2000, 'Uwagi mogą mieć maksymalnie 2000 znaków').optional(),
  delivery_type: z.enum(['pickup', 'courier', 'paczkomat']),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

const infillOptions = [
  { value: '10', label: '10%', description: 'Bardzo lekki, niska wytrzymałość' },
  { value: '20', label: '20%', description: 'Lekki, ekonomiczny' },
  { value: '30', label: '30%', description: 'Standard, dobra wydajność' },
  { value: '50', label: '50%', description: 'Wytrzymały, dla części funkcjonalnych' },
  { value: '80', label: '80%', description: 'Bardzo wytrzymały' },
  { value: '100', label: '100%', description: 'Pełny, maksymalna wytrzymałość' },
];

const priorityOptions = [
  { value: 'standard', label: 'Standard', price: 0, days: '3-5' },
  { value: 'express', label: 'Express', price: 50, days: '1-2' },
  { value: 'urgent', label: 'Urgent', price: 100, days: '< 24h' },
];

const deliveryOptions = [
  { value: 'pickup', label: 'Odbiór osobisty', price: 0 },
  { value: 'courier', label: 'Kurier', price: 15 },
  { value: 'paczkomat', label: 'Paczkomat', price: 12 },
];

export default function QuotePage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState('');
  const [colorsLoading, setColorsLoading] = useState(false);
  const [colorsError, setColorsError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [submitted, setSubmitted] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState('');

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
      delivery_type: 'courier',
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
        .select('*')
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
    setValue('color', '' as any);
    setColorsLoading(true);
    setColorsError('');

    try {
      const { data, error } = await supabase
        .from('filaments')
        .select('id, brand, color, color_hex, price_per_kg, remaining_weight_grams')
        .eq('material_id', materialId)
        .eq('active', true)
        .gt('remaining_weight_grams', 0)
        .order('color');

      if (error) {
        setColors([]);
        setColorsError('Nie udało się pobrać kolorów dla wybranego materiału.');
      } else {
        setColors((data || []).map((filament: {
          id: string;
          brand: string | null;
          color: string;
          color_hex: string | null;
          price_per_kg: number | null;
          remaining_weight_grams: number;
        }) => ({
          id: filament.id,
          name: `${filament.color}${filament.brand ? ` (${filament.brand})` : ''}`,
          hex: filament.color_hex || '#ffffff',
          price_per_kg: filament.price_per_kg,
          remaining_weight_grams: filament.remaining_weight_grams,
        })));
      }
    } catch {
      setColors([]);
      setColorsError('Nie udało się pobrać kolorów dla wybranego materiału.');
    } finally {
      setColorsLoading(false);
    }
  }, [setValue]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  useEffect(() => {
    if (watchMaterial) {
      fetchColors(watchMaterial);
      const mat = materials.find((m) => m.id === watchMaterial);
      setSelectedMaterial(mat);
    }
  }, [fetchColors, watchMaterial, materials]);

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
    setUploadProgress({ completed: 0, total: uploadedFiles.length });
    const orderId = crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      const deliveryLabel = deliveryOptions.find((option) => option.value === data.delivery_type)?.label;
      const materialName = selectedMaterial?.name || materials.find((material) => material.id === data.material_id)?.name || 'Do ustalenia';
      const selectedColor = colors.find((color) => color.id === data.color);
      const configurationNotes = [
        `Wypełnienie: ${data.infill}%`,
        `Dostawa: ${deliveryLabel ?? data.delivery_type}`,
        data.notes,
      ].filter(Boolean).join('\n');

      // Najpierw tworzymy pusty rekord. Polityka Storage pozwala wysyłać pliki
      // wyłącznie do istniejącego zamówienia należącego do użytkownika.
      const orderData = {
        id: orderId,
        user_id: user.id,
        material_id: data.material_id,
        material_name: materialName,
        color: selectedColor?.name || 'Do ustalenia',
        color_hex: selectedColor?.hex,
        layer_height: 0.2,
        quantity: data.quantity,
        priority: data.priority,
        notes: configurationNotes,
        status: 'new',
        files: [],
      };

      const { data: createdOrder, error: orderError } = await supabase
        .from('orders_3d')
        .insert([orderData])
        .select('order_number')
        .single();

      if (orderError) throw orderError;

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

      const { data: finalized, error: finalizeError } = await supabase.rpc('finalize_quote_files', {
        p_order_id: orderId,
        p_files: storedFiles,
      });

      if (finalizeError || !finalized) {
        throw new Error(finalizeError?.message || 'Nie udało się przypisać plików do zamówienia.');
      }

      toast.success('Zlecenie przyjęte', {
        description: 'Przeanalizujemy Twój projekt i wyślemy wycenę',
      });

      setSubmittedOrderNumber(createdOrder?.order_number || orderId.slice(0, 8).toUpperCase());
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
        await supabase.rpc('discard_incomplete_quote', { p_order_id: orderId });
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="bg-card border-border max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Zlecenie przyjęte!
            </h2>
            <p className="text-muted-foreground mb-6">
              Przeanalizujemy przesłane pliki i wyślemy wycenę na Twój email w ciągu 24h.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Numer zlecenia: <strong className="text-foreground">{submittedOrderNumber}</strong>
            </p>
            <Button
              onClick={() => (window.location.href = '/panel')}
              className="bg-gradient-primary hover:shadow-glow transition-shadow"
            >
              Przejdź do panelu klienta
            </Button>
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
            Prześlij swój model, wybierz parametry i otrzymaj bezpłatną wycenę w 24h
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
                          {option.price > 0 && (
                            <span className="text-sm text-primary font-medium">
                              +{option.price}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{option.days} dni roboczych</p>
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
                  <div className="grid gap-3 sm:grid-cols-3">
                    {deliveryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setValue('delivery_type', option.value as any)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          watchDelivery === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <p className="font-semibold text-foreground">{option.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {option.price === 0 ? 'Gratis' : `${option.price.toFixed(2)} zł`}
                        </p>
                      </button>
                    ))}
                  </div>
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
                        Po przesłaniu zlecenia, nasz zespół przeanalizuje pliki i przygotuje szczegółową wycenę.
                        Otrzymasz ją na swój email w ciągu 24 godzin. Wycena jest bezpłatna i niezobowiązująca.
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
                    disabled={submitting || !user}
                    className="bg-gradient-primary hover:shadow-glow min-w-[160px]"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Wysyłanie...
                      </>
                    ) : (
                      user ? 'Wyślij zlecenie' : 'Zaloguj się, aby wysłać'
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
