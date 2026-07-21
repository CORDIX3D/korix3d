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

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const paidAiEnabled = Deno.env.get("ENABLE_OPENAI_REPORTS") === "true";

    if (!paidAiEnabled || !openaiApiKey) {
      // Return a fallback analysis
      const fallbackAnalysis = generateFallbackAnalysis(reportData);
      return new Response(JSON.stringify({ analysis: fallbackAnalysis }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call OpenAI for analysis
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Jesteś doświadczonym analitykiem finansowym specjalizującym się w firmach produkcyjnych.
            Twoim zadaniem jest przeanalizowanie danych finansowych i przygotowanie szczegółowego raportu.
            Odpowiadaj w języku polskim, profesjonalnym tonem.
            Używaj sformatowanego tekstu z nagłówkami i punktami.`
          },
          {
            role: "user",
            content: `Przeanalizuj poniższe dane finansowe firmy KORIX3D i przygotuj szczegółowy raport:

            PRZYCHODY:
            - Całkowity przychód: ${reportData.revenue?.total || 0} PLN
            - Zamówienia 3D: ${reportData.revenue?.byType?.orders3D || 0} PLN
            - Zamówienia sklepowe: ${reportData.revenue?.byType?.storeOrders || 0} PLN

            KOSZTY:
            - Całkowite koszty: ${reportData.expenses?.total || 0} PLN
            - Materiały: ${reportData.expenses?.materials || 0} PLN
            - Energia: ${reportData.expenses?.electricity || 0} PLN
            - Utrzymanie: ${reportData.expenses?.maintenance || 0} PLN
            - Dostawa: ${reportData.expenses?.shipping || 0} PLN

            ZYSKI:
            - Zysk brutto: ${reportData.profit?.gross || 0} PLN
            - Marża: ${reportData.profit?.margin || 0}%

            ZAMÓWIENIA:
            - Całkowita liczba: ${reportData.orders?.total || 0}
            - Średnia wartość: ${reportData.orders?.averageValue || 0} PLN

            PRODUKCJA:
            - Godziny pracy: ${reportData.production?.totalHours || 0} h
            - Wykorzystanie maszyn: ${reportData.production?.utilization || 0}%
            - Kolejka: ${reportData.production?.queueSize || 0}

            MAGAZYN:
            - Wartość: ${reportData.warehouse?.totalValue || 0} PLN
            - Niskie stany: ${reportData.warehouse?.lowStock || 0} pozycji

            KLIENTÓW:
            - Całkowita liczba: ${reportData.customers?.total || 0}
            - Nowi: ${reportData.customers?.new || 0}

            Przygotuj analizę zawierającą:
            1. Podsumowanie wykonawcze
            2. Analizę przychodów
            3. Analizę kosztów
            4. Rekomendacje
            5. Analizę ryzyka
            6. Możliwości rozwoju`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const fallbackAnalysis = generateFallbackAnalysis(reportData);
      return new Response(JSON.stringify({ analysis: fallbackAnalysis }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const analysis = result.choices?.[0]?.message?.content || generateFallbackAnalysis(reportData);

    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("AI Analysis Error:", error);
    return new Response(
      JSON.stringify({
        error: "Błąd analizy AI",
        analysis: "Analiza AI jest tymczasowo niedostępna. Proszę skontaktować się z administratorem."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateFallbackAnalysis(data: any): string {
  const revenue = data.revenue?.total || 0;
  const expenses = data.expenses?.total || 0;
  const profit = data.profit?.gross || 0;
  const margin = data.profit?.margin || 0;

  return `AUTOMATYCZNA ANALIZA FINANSOWA

=== PODSUMOWANIE WYKONAWCZE ===
Przychód całkowity: ${revenue.toFixed(2)} PLN
Koszty całkowite: ${expenses.toFixed(2)} PLN
Zysk brutto: ${profit.toFixed(2)} PLN
Marża zysku: ${margin.toFixed(1)}%

=== ANALIZA PRZYCHODÓW ===
${revenue > 0 ? "Firma generuje przychody. " : "Brak przychodów w analizowanym okresie. "}
${data.revenue?.byType?.orders3D > data.revenue?.byType?.storeOrders ? "Głównym źródłem przychodów są zamówienia 3D." : "Sprzedaż sklepowa stanowi istotną część przychodów."}

=== ANALIZA KOSZTÓW ===
Główne kategorie kosztów:
• Materiały: ${(data.expenses?.materials || 0).toFixed(2)} PLN
• Energia: ${(data.expenses?.electricity || 0).toFixed(2)} PLN
• Utrzymanie: ${(data.expenses?.maintenance || 0).toFixed(2)} PLN

=== REKOMENDACJE ===
${margin < 20 ? "• MARŻA NISKA - Rozważ optymalizację kosztów lub dostosowanie cen" : "• Marża na akceptowalnym poziomie"}
${data.warehouse?.lowStock > 0 ? `• UZUPEŁNIENIE MAGAZYNU - ${data.warehouse.lowStock} pozycji wymaga uzupełnienia` : "• Stany magazynowe w normie"}
${data.production?.utilization < 50 ? "• NISKIE WYKORZYSTANIE - Zwiększ działania marketingowe" : "• Wykorzystanie maszyn w normie"}

=== ANALIZA RYZYKA ===
${profit < 0 ? "• WYSOKIE RYZYKO: Firma generuje stratę" : "• Ryzyko operacyjne: NISKIE"}
${data.production?.queueSize > 10 ? "• ŚREDNIE RYZYKO: Duża kolejka produkcyjna" : "• Ryzyko produkcyjne: NISKIE"}

=== MOŻLIWOŚCI ROZWOJU ===
• Rozszerzenie oferty materiałowej
• Wprowadzenie programu lojalnościowego
• Automatyzacja procesów produkcyjnych
• Rozwój kanałów sprzedaży`;
}
