import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Brak zmiennej OPENAI_API_KEY');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Brak konfiguracji Supabase');
  }

  return createSupabaseClient(url, key);
}

interface DatabaseContext {
  materials: Array<{ name: string; price_per_kg: number; available: boolean; properties: any; print_temp_min: number | null; print_temp_max: number | null }>;
  filaments: Array<{ brand: string; material_name: string; color: string; remaining_weight_grams: number; active: boolean }>;
  warehouse: Array<{ name: string; quantity: number; min_quantity: number | null }>;
  products: Array<{ name: string; price: number; stock_quantity: number; active: boolean }>;
  orders3D: Array<{ status: string; priority: string; printing_time_hours: number | null; created_at: string }>;
  recentOrders: Array<{ order_number: string; status: string; created_at: string }>;
  productionQueue: number;
  settings: Record<string, string>;
}

function createEmptyDatabaseContext(): DatabaseContext {
  return {
    materials: [],
    filaments: [],
    warehouse: [],
    products: [],
    orders3D: [],
    recentOrders: [],
    productionQueue: 0,
    settings: { context_available: 'false' },
  };
}

async function getDatabaseContext(userId: string | null, userRole: string | null): Promise<DatabaseContext> {
  const supabaseAdmin = getSupabaseAdmin();

  const [
    materialsResult,
    filamentsResult,
    warehouseResult,
    productsResult,
    orders3DResult,
    recentOrdersResult,
    settingsResult
  ] = await Promise.all([
    supabaseAdmin.from('materials').select('name, price_per_kg, available, properties, print_temp_min, print_temp_max'),
    supabaseAdmin.from('filaments').select('brand, material_name, color, remaining_weight_grams, active'),
    supabaseAdmin.from('warehouse_items').select('name, quantity, min_quantity'),
    supabaseAdmin.from('products').select('name, price, stock_quantity, active'),
    supabaseAdmin.from('orders_3d').select('status, priority, printing_time_hours, created_at'),
    userId ? supabaseAdmin.from('orders_3d').select('order_number, status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5) : { data: [] },
    supabaseAdmin.from('ai_settings').select('setting_key, setting_value')
  ]);

  const settings: Record<string, string> = {};
  (settingsResult.data || []).forEach((s: any) => {
    settings[s.setting_key] = s.setting_value;
  });

  // Calculate production queue (orders currently being processed)
  const productionQueue = (orders3DResult.data || []).filter(
    (o: any) => ['queued', 'printing', 'post_processing'].includes(o.status)
  ).length;

  // Calculate estimated production time
  const queuedOrders = (orders3DResult.data || []).filter((o: any) => o.status === 'queued');
  const printingOrders = (orders3DResult.data || []).filter((o: any) => o.status === 'printing');
  const totalQueuedHours = queuedOrders.reduce((sum: number, o: any) => sum + (o.printing_time_hours || 0), 0);
  const totalPrintingHours = printingOrders.reduce((sum: number, o: any) => sum + (o.printing_time_hours || 0), 0);

  // Working hours per day (assuming 8 hours)
  const workingHoursPerDay = 8;
  const estimatedDays = Math.ceil((totalQueuedHours + totalPrintingHours * 0.5) / workingHoursPerDay);

  return {
    materials: materialsResult.data || [],
    filaments: filamentsResult.data || [],
    warehouse: warehouseResult.data || [],
    products: productsResult.data || [],
    orders3D: orders3DResult.data || [],
    recentOrders: recentOrdersResult.data || [],
    productionQueue,
    settings: {
      ...settings,
      context_available: 'true',
      estimated_production_days: estimatedDays.toString(),
      total_queued_hours: totalQueuedHours.toString()
    }
  };
}

function buildSystemPrompt(context: DatabaseContext, userRole: string | null, userName: string | null): string {
  const hasLiveContext = context.settings.context_available === 'true';
  const availableMaterials = context.materials.filter(m => m.available).map(m =>
    `- ${m.name}: ${m.price_per_kg} PLN/kg, ${m.properties ? JSON.stringify(m.properties) : 'brak dodatkowych właściwości'}`
  ).join('\n');

  const availableFilaments = context.filaments.filter(f => f.active && f.remaining_weight_grams > 500).map(f =>
    `- ${f.brand} ${f.material_name} (${f.color}): ${f.remaining_weight_grams}g`
  ).join('\n');

  const warehouseStatus = context.warehouse.filter(w => w.min_quantity && w.quantity < w.min_quantity).map(w =>
    `- ${w.name}: ${w.quantity} szt. (minimum: ${w.min_quantity})`
  ).join('\n');

  const basePrompt = context.settings.system_prompt || 'Jesteś KORIX AI - asystentem firmy KORIX3D.';

  const liveDataPrompt = hasLiveContext
    ? `=== MATERIAŁY DOSTĘPNE ===
${availableMaterials || 'Brak dostępnych materiałów'}

=== FILAMENTY NA STANIE (min. 500g) ===
${availableFilaments || 'Brak filamentów'}

=== STAN MAGAZYNOWY - NISKIE STANY ===
${warehouseStatus || 'Wszystkie produkty w normie'}

=== PRODUKCJA ===
- Zamówienia w kolejce: ${context.productionQueue}
- Szacowany czas produkcji: ${context.settings.estimated_production_days || 'nieznany'} dni roboczych`
    : `=== DANE FIRMOWE ===
Aktualny stan magazynu i kolejki produkcyjnej jest chwilowo niedostępny. Nie twierdź, że materiału lub produktu nie ma. Odpowiadaj merytorycznie na pytania ogólne, a przy pytaniu o dostępność, cenę albo termin zaznacz, że wymagają potwierdzenia przez formularz wyceny lub kontakt z firmą.`;

  return `${basePrompt}

AKTUALNE DANE Z BAZY:

${liveDataPrompt}

=== INFORMACJE O UŻYTKOWNIKU ===
Rola: ${userRole || 'gość'}
${userName ? `Imię: ${userName}` : ''}

ZASADY ODPOWIADANIA:
1. Odpowiadaj profesjonalnie i konkretnie w języku polskim
2. Używaj aktualnych danych z bazy - NIE wymyślaj cen ani dostępności
3. Jeśli nie znasz odpowiedzi, powiedz że sprawdzisz i wróć do pytania
4. Dla pytań o materiały - polecaj konkretne produkty z listy powyżej
5. Dla pytań o produkcję - podawaj realne terminy na podstawie kolejki
6. Jeśli klient pyta o swoje zamówienie, odpowiedz ogólnie i zasugeruj zalogowanie
7. Bądź pomocny i przyjazny, jak doświadczony inżynier sprzedaży`;
}

function buildFallbackResponse(question: string, context: DatabaseContext): string {
  const normalized = question.toLowerCase();

  if (normalized.includes('materiał') || normalized.includes('filament') || normalized.includes('pla')) {
    const materials = context.materials.filter((material) => material.available).map((material) => material.name);
    if (materials.length) {
      return `Aktualnie dostępne materiały to: ${materials.join(', ')}. Jeśli opiszesz zastosowanie elementu, pomożemy dobrać najlepszy materiał.`;
    }
  }

  if (normalized.includes('czas') || normalized.includes('termin') || normalized.includes('ile trwa')) {
    const days = context.settings.estimated_production_days;
    return days && days !== '0'
      ? `Aktualny szacowany czas realizacji wynosi około ${days} dni roboczych. Dokładny termin zależy od modelu, materiału i liczby sztuk.`
      : 'Dokładny termin zależy od modelu, materiału i liczby sztuk. Prześlij plik przez formularz wyceny, a potwierdzimy czas realizacji.';
  }

  if (normalized.includes('cen') || normalized.includes('koszt') || normalized.includes('wycen')) {
    return 'Cena zależy od wymiarów modelu, materiału, wypełnienia i liczby sztuk. Prześlij plik przez formularz wyceny, aby otrzymać dokładną kalkulację.';
  }

  return 'Dziękujemy za wiadomość. Asystent AI jest chwilowo niedostępny, ale możesz przesłać projekt przez formularz wyceny lub skontaktować się z nami bezpośrednio — odpowiemy najszybciej jak to możliwe.';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { messages, conversationId, sessionId } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Brak wiadomości' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user: { id: string } | null = null;
    let profile: { role: string | null; full_name: string | null } | null = null;
    let supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
    let dbContext = createEmptyDatabaseContext();

    // Supabase enriches answers with business data and stores history, but it
    // must never prevent the assistant from answering when runtime env vars
    // are temporarily unavailable (for example in a Netlify function).
    try {
      const supabase = await createClient();
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user ? { id: authResult.data.user.id } : null;
      supabaseAdmin = getSupabaseAdmin();

      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle();
        profile = data;
      }

      dbContext = await getDatabaseContext(user?.id || null, profile?.role || null);
    } catch (supabaseError) {
      console.warn('AI context unavailable; continuing without Supabase:', supabaseError);
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(dbContext, profile?.role || null, profile?.full_name || null);

    // Get or create conversation
    let convId = conversationId;
    if (supabaseAdmin && !convId && sessionId) {
      const { data: existingConv } = await supabaseAdmin
        .from('ai_conversations')
        .select('id')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existingConv) {
        convId = existingConv.id;
      } else {
        const { data: newConv } = await supabaseAdmin
          .from('ai_conversations')
          .insert({
            session_id: sessionId,
            user_id: user?.id || null
          })
          .select('id')
          .single();
        convId = newConv?.id;
      }
    }

    // Get conversation history for context
    let conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
    if (supabaseAdmin && convId) {
      const { data: history } = await supabaseAdmin
        .from('ai_messages')
        .select('role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(20);

      conversationHistory = (history || []).map(h => ({
        role: h.role as 'user' | 'assistant' | 'system',
        content: h.content
      }));
    }

    // Prepare messages for OpenAI
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      ...messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    // Store user message
    const userMessage = messages[messages.length - 1];
    if (supabaseAdmin && convId && userMessage?.role === 'user') {
      await supabaseAdmin
        .from('ai_messages')
        .insert({
          conversation_id: convId,
          role: 'user',
          content: userMessage.content
        });
    }

    // Call OpenAI with streaming
    const model = dbContext.settings.model || 'gpt-4o-mini';
    const maxTokens = parseInt(dbContext.settings.max_tokens || '2048');
    const temperature = parseFloat(dbContext.settings.temperature || '0.7');

    let stream: AsyncIterable<{
      choices: Array<{ delta: { content?: string | null } }>;
    }>;
    try {
      const openai = getOpenAI();
      stream = await openai.chat.completions.create({
        model,
        messages: openaiMessages,
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });
    } catch (error) {
      console.error('OpenAI request error:', error);
      const fallback = buildFallbackResponse(userMessage?.content || '', dbContext);
      return new Response(
        `data: ${JSON.stringify({ content: fallback })}\n\ndata: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`,
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Stream response
    const encoder = new TextEncoder();
    let fullResponse = '';
    let tokensUsed = 0;

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              fullResponse += content;
              tokensUsed++;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          // Store assistant message
          if (supabaseAdmin && convId && fullResponse) {
            await supabaseAdmin
              .from('ai_messages')
              .insert({
                conversation_id: convId,
                role: 'assistant',
                content: fullResponse
              });

            // Update conversation timestamp
            await supabaseAdmin
              .from('ai_conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', convId);
          }

          // Log analytics
          if (supabaseAdmin) {
            await supabaseAdmin
              .from('ai_logs')
              .insert({
                user_id: user?.id || null,
                conversation_id: convId,
                query: userMessage?.content || '',
                response_time_ms: Date.now() - startTime,
                tokens_used: tokensUsed,
                model,
                success: true
              });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId: convId })}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Streaming error:', error);

          // Log error
          if (supabaseAdmin) {
            await supabaseAdmin
              .from('ai_logs')
              .insert({
                user_id: user?.id || null,
                conversation_id: convId,
                query: userMessage?.content || '',
                response_time_ms: Date.now() - startTime,
                model,
                success: false,
                error_message: String(error)
              });
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Wystąpił błąd podczas generowania odpowiedzi' })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('API Error:', error);

    const configurationError = error instanceof Error &&
      (error.message.includes('OPENAI_API_KEY') || error.message.includes('Supabase'));
    return new Response(JSON.stringify({
      error: configurationError
        ? `Bot nie jest jeszcze skonfigurowany: ${(error as Error).message}`
        : 'Wystąpił błąd podczas generowania odpowiedzi. Spróbuj ponownie.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
