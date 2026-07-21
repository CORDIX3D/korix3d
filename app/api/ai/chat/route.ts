import { NextRequest } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type DatabaseContext = {
  materials: Array<{ name: string; price_per_kg: number; available: boolean }>;
  products: Array<{ name: string; price: number; stock_quantity: number; active: boolean }>;
  productionQueue: number;
  estimatedProductionDays: number | null;
};

function createEmptyContext(): DatabaseContext {
  return {
    materials: [],
    products: [],
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
  const [materialsResult, productsResult, ordersResult] = await Promise.all([
    supabaseAdmin
      .from('materials')
      .select('name, price_per_kg, available')
      .eq('available', true)
      .order('name'),
    supabaseAdmin
      .from('products')
      .select('name, price, stock_quantity, active')
      .eq('active', true)
      .order('name')
      .limit(20),
    supabaseAdmin
      .from('orders_3d')
      .select('status, printing_time_hours')
      .in('status', ['queued', 'printing', 'post_processing']),
  ]);

  const orders = ordersResult.data || [];
  const totalHours = orders.reduce((sum: number, order: any) => sum + Number(order.printing_time_hours || 0), 0);

  return {
    materials: materialsResult.data || [],
    products: productsResult.data || [],
    productionQueue: orders.length,
    estimatedProductionDays: totalHours > 0 ? Math.ceil(totalHours / 8) : null,
  };
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function buildFreeResponse(question: string, context: DatabaseContext): string {
  const normalized = question.toLowerCase();

  if (includesAny(normalized, ['kontakt', 'telefon', 'mail', 'email'])) {
    return 'Możesz skontaktować się z KORIX3D mailowo: kontakt@korix3d.pl. Jeśli chcesz wycenić wydruk, użyj formularza „Wycena” i dołącz plik modelu 3D.';
  }

  if (includesAny(normalized, ['plik', 'stl', 'obj', '3mf', 'step'])) {
    return 'Do wyceny możesz przesłać pliki STL, OBJ, 3MF oraz STEP. Po przesłaniu modelu sprawdzimy geometrię, dobierzemy materiał i potwierdzimy ostateczną cenę oraz termin.';
  }

  if (includesAny(normalized, ['materiał', 'material', 'filament', 'pla', 'petg', 'abs', 'asa', 'tpu'])) {
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
