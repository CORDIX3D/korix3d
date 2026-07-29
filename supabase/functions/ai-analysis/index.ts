import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { isAdminRequest } from '../_shared/admin.ts';
import {
  isAllowedBrowserOrigin,
  jsonResponse,
  responseHeaders,
} from '../_shared/http.ts';

const MAX_REQUEST_BYTES = 256 * 1024;

Deno.serve(async (request: Request) => {
  if (!isAllowedBrowserOrigin(request)) {
    return jsonResponse(request, { error: 'Niedozwolone źródło żądania.' }, 403);
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: responseHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(request, { error: 'Method not allowed' }, 405);
  }

  if (!(await isAdminRequest(request))) {
    return jsonResponse(request, { error: 'Brak uprawnień administratora.' }, 403);
  }

  try {
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return jsonResponse(request, { error: 'Żądanie jest zbyt duże.' }, 413);
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse(request, { error: 'Żądanie jest zbyt duże.' }, 413);
    }

    const body = JSON.parse(rawBody) as { reportData?: unknown };
    if (!body.reportData || typeof body.reportData !== 'object') {
      return jsonResponse(request, { error: 'Missing reportData' }, 400);
    }

    return jsonResponse(request, {
      analysis: generateFallbackAnalysis(body.reportData as Record<string, any>),
    });
  } catch (error) {
    console.error('Local analysis error:', error instanceof Error ? error.name : 'unknown');
    return jsonResponse(
      request,
      {
        error: 'Błąd analizy',
        analysis: 'Analiza jest tymczasowo niedostępna. Spróbuj ponownie później.',
      },
      500
    );
  }
});

function generateFallbackAnalysis(data: Record<string, any>): string {
  const revenue = Number(data.revenue?.total || 0);
  const expenses = Number(data.expenses?.total || 0);
  const profit = Number(data.profit?.gross || revenue - expenses);
  const margin = Number(data.profit?.margin || (revenue > 0 ? (profit / revenue) * 100 : 0));
  const lowStock = Number(data.warehouse?.lowStock || 0);
  const queueSize = Number(data.production?.queueSize || 0);
  const utilization = Number(data.production?.utilization || 0);

  return `AUTOMATYCZNA ANALIZA FINANSOWA

=== PODSUMOWANIE ===
Przychód: ${revenue.toFixed(2)} PLN
Koszty: ${expenses.toFixed(2)} PLN
Zysk brutto: ${profit.toFixed(2)} PLN
Marża: ${margin.toFixed(1)}%

=== WNIOSKI ===
${revenue > 0 ? 'Firma generuje przychody w analizowanym okresie.' : 'Brak przychodów w analizowanym okresie.'}
${profit >= 0 ? 'Wynik operacyjny jest dodatni.' : 'Wynik operacyjny jest ujemny i wymaga kontroli kosztów.'}
${lowStock > 0 ? `Magazyn wymaga uwagi: ${lowStock} pozycji ma niski stan.` : 'Stany magazynowe nie wskazują krytycznych braków.'}
${queueSize > 10 ? `Kolejka produkcyjna jest wysoka: ${queueSize} zleceń.` : 'Kolejka produkcyjna jest pod kontrolą.'}

=== REKOMENDACJE ===
${margin < 20 ? '• Przeanalizuj ceny i koszty materiałów, bo marża jest niska.' : '• Utrzymuj obecną politykę cenową i monitoruj marżę.'}
${lowStock > 0 ? '• Uzupełnij pozycje magazynowe poniżej minimum.' : '• Kontynuuj regularny monitoring magazynu.'}
${utilization < 50 ? '• Rozważ działania sprzedażowe, bo wykorzystanie produkcji jest niskie.' : '• Monitoruj obciążenie maszyn i terminy realizacji.'}
• Kontynuuj zbieranie danych o zamówieniach, kosztach i czasie produkcji.`;
}
