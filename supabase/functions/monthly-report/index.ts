import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportRequest {
  type: 'manual' | 'scheduled';
  year?: number;
  month?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let year: number;
    let month: number;

    if (req.method === "POST") {
      const body: ReportRequest = await req.json();

      if (body.type === 'manual' && body.year && body.month) {
        year = body.year;
        month = body.month;
      } else {
        // Scheduled - generate for previous month
        const now = new Date();
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
        year = prevMonth.getFullYear();
        month = prevMonth.getMonth() + 1;
      }
    } else {
      // GET request - check schedule and generate if needed
      const now = new Date();

      // Check if we need to generate
      const { data: schedule } = await supabase
        .from('report_schedules')
        .select('*')
        .eq('schedule_type', 'monthly')
        .eq('active', true)
        .single();

      if (!schedule) {
        return new Response(
          JSON.stringify({ message: "No active schedule found" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if we already generated this month
      const { data: existingReport } = await supabase
        .from('accounting_reports')
        .select('id')
        .eq('report_year', now.getFullYear())
        .eq('report_month', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
        .maybeSingle();

      if (existingReport) {
        return new Response(
          JSON.stringify({ message: "Report already generated for this month" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate for previous month
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1);
      year = prevMonth.getFullYear();
      month = prevMonth.getMonth() + 1;
    }

    // Check if report already exists
    const { data: existingReport } = await supabase
      .from('accounting_reports')
      .select('id')
      .eq('report_year', year)
      .eq('report_month', new Date(year, month - 1, 1).toISOString().split('T')[0])
      .maybeSingle();

    if (existingReport) {
      return new Response(
        JSON.stringify({
          message: `Report for ${year}-${month} already exists`,
          reportId: existingReport.id
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reportFileName = `KORIX3D_Raport_${year}-${month.toString().padStart(2, '0')}.txt`;
    const reportFilePath = `${year}/${month}/${reportFileName}`;

    // Create report record
    const { data: report, error: insertError } = await supabase
      .from('accounting_reports')
      .insert({
        report_month: new Date(year, month - 1, 1).toISOString().split('T')[0],
        report_year: year,
        report_type: 'monthly',
        file_name: reportFileName,
        file_path: reportFilePath,
        status: 'generating'
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create report record: ${insertError.message}`);
    }

    // Fetch financial data
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const [
      { data: orders3D },
      { data: storeOrders },
      { data: settings },
      { data: filaments },
      { data: warehouse },
      { data: profiles }
    ] = await Promise.all([
      supabase.from('orders_3d').select('*')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString()),
      supabase.from('store_orders').select('*')
        .gte('created_at', periodStart.toISOString())
        .lte('created_at', periodEnd.toISOString()),
      supabase.from('settings').select('key, value'),
      supabase.from('filaments').select('*'),
      supabase.from('warehouse_items').select('*'),
      supabase.from('profiles').select('id, role, created_at')
    ]);

    // Calculate metrics
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => {
      settingsMap[s.key] = s.value || '';
    });

    const orders3DRevenue = (orders3D || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
    const storeOrdersRevenue = (storeOrders || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
    const totalRevenue = orders3DRevenue + storeOrdersRevenue;

    const materialCosts = (orders3D || []).reduce((sum: number, o: any) => sum + (o.material_cost || 0), 0);
    const productionHours = (orders3D || []).reduce((sum: number, o: any) => sum + (o.printing_time_hours || 0), 0);

    const vatRate = parseFloat(settingsMap.vat_rate || '23') / 100;
    const electricityCost = parseFloat(settingsMap.electricity_hour_cost || '2') * productionHours;
    const maintenanceCost = parseFloat(settingsMap.maintenance_hour_cost || '5') * productionHours;
    const packagingCost = parseFloat(settingsMap.packaging_cost || '5') * ((orders3D || []).length);
    const defaultShippingCost = parseFloat(settingsMap.courier_price || settingsMap.shipping_cost || '15');
    const orders3DShipping = (orders3D || []).filter((o: any) => ['shipped', 'completed'].includes(o.status)).length * defaultShippingCost;
    const storeOrdersShipping = (storeOrders || [])
      .filter((o: any) => ['shipped', 'delivered'].includes(o.status))
      .reduce((sum: number, o: any) => sum + Number(o.shipping_cost || 0), 0);
    const shippingCost = orders3DShipping + storeOrdersShipping;

    const totalExpenses = materialCosts + electricityCost + maintenanceCost + packagingCost + shippingCost;
    const grossProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const warehouseValue = (warehouse || []).reduce(
      (sum: number, item: any) => sum + (item.quantity || 0) * (item.purchase_price || 0),
      0
    );

    const newCustomers = (profiles || []).filter((p: any) => {
      const created = new Date(p.created_at);
      return created >= periodStart && created <= periodEnd && p.role === 'customer';
    }).length;

    // Update report with summary
    const summary = {
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: grossProfit,
      margin,
      orders: (orders3D || []).length + (storeOrders || []).length,
      customers: newCustomers,
      warehouseValue,
      productionHours
    };

    // Generate a lightweight text report for the current MVP.
    const excelContent = `
KORIX3D - Raport Finansowy
Okres: ${year}-${month.toString().padStart(2, '0')}

PRZYCHODY
Całkowity przychód: ${totalRevenue.toFixed(2)} PLN
  - Zamówienia 3D: ${orders3DRevenue.toFixed(2)} PLN
  - Sklep: ${storeOrdersRevenue.toFixed(2)} PLN

KOSZTY
Całkowite koszty: ${totalExpenses.toFixed(2)} PLN
  - Materiały: ${materialCosts.toFixed(2)} PLN
  - Energia: ${electricityCost.toFixed(2)} PLN
  - Utrzymanie: ${maintenanceCost.toFixed(2)} PLN
  - Dostawa: ${shippingCost.toFixed(2)} PLN

ZYSKI
Zysk brutto: ${grossProfit.toFixed(2)} PLN
Marża: ${margin.toFixed(1)}%

INNE
Godziny produkcji: ${productionHours.toFixed(1)}
Nowi klienci: ${newCustomers}
Wartość magazynu: ${warehouseValue.toFixed(2)} PLN
    `.trim();

    const fileBlob = new Blob([excelContent], { type: 'text/plain' });

    const { error: uploadError } = await supabase.storage
      .from('accounting-reports')
      .upload(reportFilePath, fileBlob);

    if (uploadError) {
      console.error('Upload error:', uploadError);
    }

    // Update report status
    const { error: updateError } = await supabase
      .from('accounting_reports')
      .update({
        status: 'generated',
        file_path: reportFilePath,
        file_size: excelContent.length,
        summary,
        generated_at: new Date().toISOString()
      })
      .eq('id', report.id);

    if (updateError) {
      console.error('Update error:', updateError);
    }

    // Update schedule
    await supabase
      .from('report_schedules')
      .update({
        last_run: new Date().toISOString(),
        next_run: new Date(year, month, 1).toISOString()
      })
      .eq('schedule_type', 'monthly');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Report generated for ${year}-${month}`,
        reportId: report.id,
        summary
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error('Monthly report error:', error);

    // Mark as failed if we have a report record
    // (would need to track the report ID properly in production)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate report'
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
