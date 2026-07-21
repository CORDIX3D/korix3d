import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type DatabaseContext = {
  materials: Array<{ name: string; price_per_kg: number; available: boolean }>;
  filaments: Array<{
    brand: string;
    material_name: string;
    color: string;
    color_hex: string | null;
    remaining_weight_grams: number;
    min_weight_grams: number | null;
    location: string | null;
    active: boolean | null;
  }>;
  products: Array<{
    id?: string;
    sku: string | null;
    name: string;
    slug: string | null;
    price: number;
    stock_quantity: number;
    min_stock_quantity: number | null;
    active: boolean;
  }>;
  warehouseItems: Array<{
    sku: string | null;
    name: string;
    quantity: number;
    min_quantity: number | null;
    warehouse_location: string | null;
  }>;
  productionQueue: number;
  estimatedProductionDays: number | null;
};

function createEmptyContext(): DatabaseContext {
  return {
    materials: [],
    filaments: [],
    products: [],
    warehouseItems: [],
    productionQueue: 0,
    estimatedProductionDays: null,
  };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Brak konfiguracji Supabase');
  }

  return createSupabaseClient(url, key);
}

async function getDatabaseContext(): Promise<DatabaseContext> {
  const supabaseAdmin = getSupabaseAdmin();
  const [materialsResult, filamentsResult, productsResult, warehouseResult, ordersResult] = await Promise.all([
    supabaseAdmin
      .from('materials')
      .select('name, price_per_kg, available')
      .eq('available', true)
      .order('name'),
    supabaseAdmin
      .from('filaments')
      .select('brand, material_name, color, color_hex, remaining_weight_grams, min_weight_grams, location, active')
      .eq('active', true)
      .order('material_name'),
    supabaseAdmin
      .from('products')
      .select('id, sku, name, slug, price, stock_quantity, min_stock_quantity, active')
      .eq('active', true)
      .order('name'),
    supabaseAdmin
      .from('warehouse_items')
      .select('sku, name, quantity, min_quantity, warehouse_location')
      .order('name'),
    supabaseAdmin
      .from('orders_3d')
      .select('status, printing_time_hours')
      .in('status', ['queued', 'printing', 'post_processing']),
  ]);

  const orders = ordersResult.data || [];
  const totalHours = orders.reduce((sum: number, order: any) => sum + Number(order.printing_time_hours || 0), 0);

  return {
    materials: materialsResult.data || [],
    filaments: filamentsResult.data || [],
    products: productsResult.data || [],
    warehouseItems: warehouseResult.data || [],
    productionQueue: orders.length,
    estimatedProductionDays: totalHours > 0 ? Math.ceil(totalHours / 8) : null,
  };
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function normalizeText(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stockStatusLabel(quantity: number, minimum: number | null | undefined) {
  if (quantity <= 0) return 'niedostępny';
  if (minimum && quantity <= minimum) return 'dostępny, ale stan jest niski';
  return 'dostępny';
}

function scoreTextMatch(question: string, values: Array<string | null | undefined>) {
  const normalizedQuestion = normalizeText(question);
  let score = 0;

  values.forEach((value) => {
    const normalizedValue = normalizeText(value);
    if (!normalizedValue) return;

    const tokens = normalizedValue.split(' ').filter((token) => token.length >= 3);
    if (normalizedQuestion.includes(normalizedValue)) score += 10;
    score += tokens.filter((token) => normalizedQuestion.includes(token)).length;
  });

  return score;
}

function scoreProductMatch(question: string, product: DatabaseContext['products'][number]) {
  let score = scoreTextMatch(question, [product.name, product.slug]);
  const normalizedQuestion = normalizeText(question);
  const sku = normalizeText(product.sku);

  if (sku && normalizedQuestion.includes(sku)) score += 12;
  return score;
}

function findMatchingProducts(question: string, context: DatabaseContext) {
  return context.products
    .map((product) => ({ product, score: scoreProductMatch(question, product) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.product);
}

function findWarehouseItemForProduct(product: DatabaseContext['products'][number], context: DatabaseContext) {
  const productSku = normalizeText(product.sku);
  const productName = normalizeText(product.name);

  return context.warehouseItems.find((item) => {
    const itemSku = normalizeText(item.sku);
    const itemName = normalizeText(item.name);
    return Boolean(
      (productSku && itemSku && productSku === itemSku) ||
      (productName && itemName && (itemName.includes(productName) || productName.includes(itemName)))
    );
  });
}

function formatProductStock(product: DatabaseContext['products'][number], context: DatabaseContext) {
  const warehouseItem = findWarehouseItemForProduct(product, context);
  const quantity = Number(product.stock_quantity || 0);
  const minimum = product.min_stock_quantity ?? warehouseItem?.min_quantity ?? null;
  const status = stockStatusLabel(quantity, minimum);
  const warehouseDetails = warehouseItem
    ? ` Magazyn pokazuje ${warehouseItem.quantity} szt.${warehouseItem.warehouse_location ? `, lokalizacja: ${warehouseItem.warehouse_location}.` : '.'}`
    : '';

  return `${product.name}${product.sku ? ` (${product.sku})` : ''}: ${status}, stan sklepu: ${quantity} szt., cena: ${Number(product.price).toFixed(2)} zł.${warehouseDetails}`;
}

function scoreFilamentMatch(question: string, filament: DatabaseContext['filaments'][number]) {
  return scoreTextMatch(question, [filament.brand, filament.material_name, filament.color]);
}

function findMatchingFilaments(question: string, context: DatabaseContext) {
  return context.filaments
    .map((filament) => ({ filament, score: scoreFilamentMatch(question, filament) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.filament);
}

function formatFilamentStock(filament: DatabaseContext['filaments'][number]) {
  const remaining = Number(filament.remaining_weight_grams || 0);
  const minimum = filament.min_weight_grams ?? null;
  const status = stockStatusLabel(remaining, minimum);
  const location = filament.location ? ` Lokalizacja: ${filament.location}.` : '';
  const colorHex = filament.color_hex ? ` Próbka koloru: ${filament.color_hex}.` : '';

  return `${filament.material_name} ${filament.color} (${filament.brand}): ${status}, zostało ${remaining} g.${minimum ? ` Minimum: ${minimum} g.` : ''}${location}${colorHex}`;
}

function findMatchingMaterials(question: string, context: DatabaseContext) {
  const normalizedQuestion = normalizeText(question);
  return context.materials.filter((material) => {
    const materialName = normalizeText(material.name);
    const tokens = materialName.split(' ').filter((token) => token.length >= 3);
    return normalizedQuestion.includes(materialName) || tokens.some((token) => normalizedQuestion.includes(token));
  });
}

function buildFreeResponse(question: string, context: DatabaseContext): string {
  const normalized = question.toLowerCase();
  const asksAboutStock = includesAny(normalized, [
    'stan',
    'stanie',
    'magazyn',
    'magazynie',
    'dostęp',
    'dostep',
    'dostępny',
    'dostepny',
    'ile jest',
    'ile macie',
    'czy macie',
    'czy jest',
    'produkt',
    'sklep',
    'kup',
    'koszyk',
    'kolor',
    'filament',
    'szpul',
  ]);
  const asksAboutFilaments = includesAny(normalized, ['filament', 'szpula', 'szpulka', 'pla', 'petg', 'abs', 'asa', 'tpu', 'kolor']);

  const matchingFilaments = findMatchingFilaments(question, context);
  if ((asksAboutStock || asksAboutFilaments) && matchingFilaments.length > 0) {
    return [
      'Sprawdziłem magazyn filamentów:',
      matchingFilaments.slice(0, 6).map(formatFilamentStock).join('\n'),
      'To są stany z bazy magazynowej, bez użycia płatnego AI.',
    ].join('\n');
  }

  const matchingProducts = findMatchingProducts(question, context);
  if (asksAboutStock && matchingProducts.length > 0) {
    return matchingProducts
      .slice(0, 5)
      .map((product) => formatProductStock(product, context))
      .join('\n');
  }

  if (asksAboutStock && context.products.length > 0) {
    const availableProducts = context.products
      .filter((product) => product.stock_quantity > 0)
      .sort((a, b) => b.stock_quantity - a.stock_quantity)
      .slice(0, 8)
      .map((product) => `${product.name}: ${product.stock_quantity} szt., ${Number(product.price).toFixed(2)} zł`);

    const lowFilaments = context.filaments
      .filter((filament) => Number(filament.remaining_weight_grams || 0) <= Number(filament.min_weight_grams || 0))
      .slice(0, 5)
      .map((filament) => `${filament.material_name} ${filament.color}: ${filament.remaining_weight_grams} g`);

    const unavailableCount = context.products.filter((product) => product.stock_quantity <= 0).length;
    return [
      availableProducts.length
        ? `Największe dostępne stany w sklepie:\n${availableProducts.join('\n')}`
        : 'Aktualnie nie widzę produktów z dodatnim stanem sklepowym.',
      lowFilaments.length ? `Niskie stany filamentów:\n${lowFilaments.join('\n')}` : '',
      unavailableCount > 0 ? `Produkty bez stanu: ${unavailableCount}.` : '',
      'Jeśli pytasz o konkretny produkt, materiał albo kolor, podaj nazwę, SKU lub kolor — sprawdzę dokładny stan.',
    ].filter(Boolean).join('\n\n');
  }

  const matchingMaterials = findMatchingMaterials(question, context);
  if (matchingMaterials.length > 0) {
    return matchingMaterials
      .slice(0, 5)
      .map((material) => `${material.name}: ${material.available ? 'dostępny' : 'niedostępny'}${material.price_per_kg ? `, cena bazowa: ${Number(material.price_per_kg).toFixed(0)} zł/kg` : ''}.`)
      .join('\n');
  }

  if (includesAny(normalized, ['kontakt', 'telefon', 'mail', 'email'])) {
    return 'Możesz skontaktować się z KORIX3D mailowo: kontakt@korix3d.pl. Jeśli chcesz wycenić wydruk, użyj formularza „Wycena” i dołącz plik modelu 3D.';
  }

  if (includesAny(normalized, ['plik', 'stl', 'obj', '3mf', 'step'])) {
    return 'Do wyceny możesz przesłać pliki STL, OBJ, 3MF oraz STEP. Po przesłaniu modelu sprawdzimy geometrię, dobierzemy materiał i potwierdzimy ostateczną cenę oraz termin.';
  }

  if (includesAny(normalized, ['materiał', 'material', 'filament', 'pla', 'petg', 'abs', 'asa', 'tpu'])) {
    const filamentSummary = context.filaments
      .slice(0, 8)
      .map((filament) => `${filament.material_name} ${filament.color} (${filament.remaining_weight_grams} g)`);

    if (filamentSummary.length > 0) {
      return `Aktualnie w magazynie widzę m.in.: ${filamentSummary.join(', ')}. Jeśli napiszesz konkretny materiał i kolor, sprawdzę dokładny stan szpulki.`;
    }

    const materials = context.materials.map((material) =>
      `${material.name}${material.price_per_kg ? ` (${Number(material.price_per_kg).toFixed(0)} zł/kg)` : ''}`
    );

    if (materials.length > 0) {
      return `Aktualnie w bazie widzę takie dostępne materiały: ${materials.join(', ')}. Jeśli napiszesz, do czego ma służyć element, pomożemy dobrać materiał pod wytrzymałość, temperaturę, wygląd albo cenę.`;
    }

    return 'Dobór materiału zależy od zastosowania. PLA sprawdza się do modeli wizualnych, PETG do części bardziej użytkowych, ASA/ABS do większej odporności, a TPU do elementów elastycznych. Ostateczną dostępność potwierdzimy przy wycenie.';
  }

  if (includesAny(normalized, ['cena', 'koszt', 'wycena', 'ile kosztuje'])) {
    return 'Cena zależy od wymiarów modelu, materiału, wypełnienia, jakości i liczby sztuk. Najlepiej prześlij plik przez formularz wyceny — podamy cenę szacunkową, a ostateczną potwierdzimy po analizie modelu.';
  }

  if (includesAny(normalized, ['czas', 'termin', 'ile trwa', 'realizacja'])) {
    if (context.estimatedProductionDays) {
      return `Na podstawie aktualnej kolejki szacowany czas produkcji to około ${context.estimatedProductionDays} dni roboczych. Dokładny termin zależy od modelu, materiału i liczby sztuk.`;
    }

    return 'Termin realizacji zależy od modelu, materiału i liczby sztuk. Po przesłaniu pliku przez formularz wyceny potwierdzimy realny czas wykonania.';
  }

  if (includesAny(normalized, ['sklep', 'produkt', 'kup', 'koszyk'])) {
    const products = context.products
      .filter((product) => product.stock_quantity > 0)
      .slice(0, 5)
      .map((product) => `${product.name} (${Number(product.price).toFixed(2)} zł)`);

    if (products.length > 0) {
      return `W sklepie są dostępne m.in.: ${products.join(', ')}. Pełną listę znajdziesz w zakładce „Sklep”.`;
    }

    return 'Produkty dostępne w sklepie znajdziesz w zakładce „Sklep”. Jeśli czegoś nie ma na stanie, napisz do nas — sprawdzimy możliwość realizacji.';
  }

  return 'Jestem bezpłatnym asystentem KORIX3D. Mogę pomóc w doborze materiału, przygotowaniu pliku do wyceny, informacjach o terminach, sklepie i kontakcie. Napisz, co chcesz wydrukować i do czego element będzie używany.';
}

function createEventStream(content: string, conversationId?: string | null) {
  return new Response(
    `data: ${JSON.stringify({ content })}\n\ndata: ${JSON.stringify({ done: true, conversationId })}\n\n`,
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages, conversationId, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Brak wiadomości' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userMessage = messages[messages.length - 1];
    const question = typeof userMessage?.content === 'string' ? userMessage.content : '';

    let userId: string | null = null;
    let convId = conversationId || null;
    let supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
    let context = createEmptyContext();

    try {
      const supabase = await createClient();
      const authResult = await supabase.auth.getUser();
      userId = authResult.data.user?.id || null;
      supabaseAdmin = getSupabaseAdmin();
      context = await getDatabaseContext();

      if (!convId && sessionId) {
        const { data: existingConversation } = await supabaseAdmin
          .from('ai_conversations')
          .select('id')
          .eq('session_id', sessionId)
          .maybeSingle();

        if (existingConversation) {
          convId = existingConversation.id;
        } else {
          const { data: newConversation } = await supabaseAdmin
            .from('ai_conversations')
            .insert({
              session_id: sessionId,
              user_id: userId,
            })
            .select('id')
            .single();
          convId = newConversation?.id || null;
        }
      }

      if (convId && question) {
        await supabaseAdmin
          .from('ai_messages')
          .insert({
            conversation_id: convId,
            role: 'user',
            content: question,
          });
      }
    } catch (contextError) {
      console.warn('AI local context unavailable; answering without database context:', contextError);
    }

    const answer = buildFreeResponse(question, context);

    try {
      if (supabaseAdmin && convId) {
        await supabaseAdmin
          .from('ai_messages')
          .insert({
            conversation_id: convId,
            role: 'assistant',
            content: answer,
          });

        await supabaseAdmin
          .from('ai_logs')
          .insert({
            user_id: userId,
            conversation_id: convId,
            query: question,
            response_time_ms: Date.now() - startTime,
            tokens_used: 0,
            model: 'free-local-assistant',
            success: true,
          });
      }
    } catch (logError) {
      console.warn('AI local answer was created, but history logging failed:', logError);
    }

    return createEventStream(answer, convId);
  } catch (error) {
    console.error('AI local API error:', error);
    return createEventStream('Asystent jest chwilowo niedostępny. Możesz skorzystać z formularza wyceny albo napisać na kontakt@korix3d.pl.');
  }
}
