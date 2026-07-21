import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { reportData } = await req.json();

    if (!reportData) {
      return new Response(JSON.stringify({ error: "Missing reportData" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ analysis: generateFallbackAnalysis(reportData) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Local analysis error:", error);
    return new Response(
      JSON.stringify({
        error: "Błąd analizy",
        analysis: "Analiza jest tymczasowo niedostępna. Spróbuj ponownie później.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateFallbackAnalysis(data: any): string {
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
${revenue > 0 ? "Firma generuje przychody w analizowanym okresie." : "Brak przychodów w analizowanym okresie."}
${profit >= 0 ? "Wynik operacyjny jest dodatni." : "Wynik operacyjny jest ujemny i wymaga kontroli kosztów."}
${lowStock > 0 ? `Magazyn wymaga uwagi: ${lowStock} pozycji ma niski stan.` : "Stany magazynowe nie wskazują krytycznych braków."}
${queueSize > 10 ? `Kolejka produkcyjna jest wysoka: ${queueSize} zleceń.` : "Kolejka produkcyjna jest pod kontrolą."}

=== REKOMENDACJE ===
${margin < 20 ? "• Przeanalizuj ceny i koszty materiałów, bo marża jest niska." : "• Utrzymuj obecną politykę cenową i monitoruj marżę."}
${lowStock > 0 ? "• Uzupełnij pozycje magazynowe poniżej minimum." : "• Kontynuuj regularny monitoring magazynu."}
${utilization < 50 ? "• Rozważ działania sprzedażowe, bo wykorzystanie produkcji jest niskie." : "• Monitoruj obciążenie maszyn i terminy realizacji."}
• Kontynuuj zbieranie danych o zamówieniach, kosztach i czasie produkcji.`;
}
