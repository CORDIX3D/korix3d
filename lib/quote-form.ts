import { z } from 'zod';

export const quoteSchema = z.object({
  material_id: z.string().min(1, 'Wybierz materiał'),
  color: z.string().min(1, 'Wybierz kolor'),
  infill: z.enum(['10', '20', '30', '50', '80', '100']),
  quantity: z.number({ invalid_type_error: 'Podaj liczbę sztuk' })
    .int('Ilość musi być liczbą całkowitą')
    .min(1, 'Minimalna ilość to 1')
    .max(1000, 'Maksymalna ilość to 1000'),
  priority: z.enum(['standard', 'express', 'urgent']),
  notes: z.string().trim().max(2000, 'Uwagi mogą mieć maksymalnie 2000 znaków').optional(),
  delivery_type: z.string().min(1, 'Wybierz metodę dostawy'),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

export type AutomaticQuote = {
  state: 'calculating' | 'ready' | 'manual_review';
  order_number: string;
  slicing_status: string;
  printing_time_hours: number | null;
  filament_used_grams: number | null;
  net_price: number | null;
  final_price: number | null;
  sliced_at?: string | null;
};

export type QuoteColor = {
  id: string;
  name: string;
  hex: string;
};

export const slicingProgress: Record<string, { label: string; value: number }> = {
  not_started: { label: 'Przygotowujemy plik', value: 10 },
  pending: { label: 'Model czeka na analizę Creality Print', value: 30 },
  processing: { label: 'Creality Print oblicza czas i zużycie materiału', value: 70 },
  completed: { label: 'Obliczamy końcową cenę', value: 95 },
};

export const infillOptions = [
  { value: '10', label: '10%', description: 'Bardzo lekki, niska wytrzymałość' },
  { value: '20', label: '20%', description: 'Lekki, ekonomiczny' },
  { value: '30', label: '30%', description: 'Standard, dobra wydajność' },
  { value: '50', label: '50%', description: 'Wytrzymały, dla części funkcjonalnych' },
  { value: '80', label: '80%', description: 'Bardzo wytrzymały' },
  { value: '100', label: '100%', description: 'Pełny, maksymalna wytrzymałość' },
] as const;

export const priorityOptions = [
  { value: 'standard', label: 'Standard', description: 'Termin ustalany po analizie pliku' },
  { value: 'express', label: 'Express', description: 'Przyspieszona kolejka po potwierdzeniu dostępności' },
  { value: 'urgent', label: 'Pilne', description: 'Najwyższy priorytet po indywidualnym potwierdzeniu' },
] as const;

export const serviceNotes: Record<string, string> = {
  prototypowanie: 'Interesuje mnie prototypowanie.',
  'czesci-inzynieryjne': 'Interesuje mnie wykonanie części inżynieryjnej.',
  'produkcja-seryjna': 'Interesuje mnie produkcja małoseryjna.',
};

export function formatQuotePrice(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} zł`;
}
