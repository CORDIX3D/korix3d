import ExcelJS from 'exceljs';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from 'date-fns';
import { pl } from 'date-fns/locale';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(url, key);
}

interface ReportData {
  period: { start: Date; end: Date };
  company: {
    name: string;
    address: string;
    nip: string;
    email: string;
    phone: string;
  };
  revenue: {
    total: number;
    byType: { orders3D: number; storeOrders: number };
    byMonth: Array<{ month: string; inflow: number; outflow: number }>;
  };
  expenses: {
    total: number;
    materials: number;
    electricity: number;
    maintenance: number;
    shipping: number;
    salaries: number;
    marketing: number;
    other: number;
  };
  profit: {
    gross: number;
    net: number;
    margin: number;
  };
  vat: {
    input: number;
    output: number;
    due: number;
  };
  orders: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageValue: number;
  };
  customers: {
    total: number;
    new: number;
    returning: number;
    top: Array<{ name: string; orders: number; value: number }>;
    growth: number;
  };
  products: {
    top: Array<{ name: string; sold: number; revenue: number }>;
    byCategory: Record<string, number>;
  };
  warehouse: {
    totalValue: number;
    items: number;
    lowStock: number;
    changes: Array<{ item: string; change: number }>;
  };
  filaments: {
    totalUsed: number;
    byMaterial: Record<string, number>;
    byColor: Array<{ color: string; grams: number }>;
    costPerGram: number;
  };
  production: {
    totalHours: number;
    byStatus: Record<string, number>;
    utilization: number;
    queueSize: number;
  };
  cashFlow: {
    inflow: number;
    outflow: number;
    balance: number;
    byMonth: Array<{ month: string; inflow: number; outflow: number }>;
  };
  analytics: {
    conversionRate: number;
    averageOrderValue: number;
    repeatPurchaseRate: number;
    customerLifetimeValue: number;
  };
  forecast: {
    nextMonthRevenue: number;
    nextMonthOrders: number;
    confidence: string;
  };
}

async function fetchReportData(periodStart: Date, periodEnd: Date): Promise<ReportData> {
  const supabase = getSupabaseAdmin();

  // Fetch company settings
  const { data: settings } = await supabase
    .from('settings')
    .select('key, value');

  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: any) => {
    settingsMap[s.key] = s.value || '';
  });

  const company = {
    name: settingsMap.company_name || 'KORIX3D',
    address: settingsMap.company_address || '',
    nip: settingsMap.nip || '',
    email: settingsMap.company_email || '',
    phone: settingsMap.company_phone || ''
  };

  // Fetch 3D orders
  const { data: orders3D } = await supabase
    .from('orders_3d')
    .select('*')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  // Fetch store orders
  const { data: storeOrders } = await supabase
    .from('store_orders')
    .select('*')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  // Calculate revenue
  const orders3DRevenue = (orders3D || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
  const storeOrdersRevenue = (storeOrders || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const totalRevenue = orders3DRevenue + storeOrdersRevenue;

  // Fetch filaments
  const { data: filaments } = await supabase
    .from('filaments')
    .select('*');

  const { data: filamentUsage } = await supabase
    .from('filament_usage_log')
    .select('*')
    .gte('created_at', periodStart.toISOString())
    .lte('created_at', periodEnd.toISOString());

  // Calculate filament usage
  const totalFilamentUsed = (filamentUsage || []).reduce((sum: number, f: any) => sum + (f.grams_used || 0), 0);

  // Fetch warehouse
  const { data: warehouseItems } = await supabase
    .from('warehouse_items')
    .select('*');

  const warehouseValue = (warehouseItems || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 0) * (item.purchase_price || 0),
    0
  );

  // Fetch customers
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'customer');

  const newCustomers = (profiles || []).filter((p: any) => {
    const created = new Date(p.created_at);
    return created >= periodStart && created <= periodEnd;
  }).length;

  // Calculate expenses from settings
  const printingHourCost = parseFloat(settingsMap.printing_hour_cost || '50');
  const electricityCost = parseFloat(settingsMap.electricity_hour_cost || '2');
  const maintenanceCost = parseFloat(settingsMap.maintenance_hour_cost || '5');
  const packagingCost = parseFloat(settingsMap.packaging_cost || '5');
  const vatRate = parseFloat(settingsMap.vat_rate || '23') / 100;

  // Calculate production hours
  const productionHours = (orders3D || []).reduce(
    (sum: number, o: any) => sum + (o.printing_time_hours || 0),
    0
  );

  // Calculate material costs
  const materialCosts = (orders3D || []).reduce(
    (sum: number, o: any) => sum + (o.material_cost || 0),
    0
  );

  // Calculate expenses
  const electricity = productionHours * electricityCost;
  const maintenance = productionHours * maintenanceCost;
  const shipping = (orders3D || []).filter((o: any) => o.status === 'shipped').length * 15 +
                   (storeOrders || []).filter((o: any) => o.status === 'shipped').length * 15;

  const expenses = {
    total: materialCosts + electricity + maintenance + shipping + (packagingCost * ((orders3D || []).length)),
    materials: materialCosts,
    electricity,
    maintenance,
    shipping,
    salaries: 0, // Would need employee data
    marketing: 0, // Would need marketing spend data
    other: (packagingCost * ((orders3D || []).length))
  };

  // Calculate profit
  const grossProfit = totalRevenue - expenses.total;
  const netProfit = grossProfit / (1 + vatRate);

  // Calculate VAT
  const vatOutput = totalRevenue * vatRate;
  const vatInput = expenses.materials * vatRate;
  const vatDue = vatOutput - vatInput;

  // Order stats
  const orderStatusCounts: Record<string, number> = {};
  (orders3D || []).forEach((o: any) => {
    orderStatusCounts[o.status] = (orderStatusCounts[o.status] || 0) + 1;
  });

  const orderPriorityCounts: Record<string, number> = {};
  (orders3D || []).forEach((o: any) => {
    orderPriorityCounts[o.priority] = (orderPriorityCounts[o.priority] || 0) + 1;
  });

  const totalOrders = (orders3D || []).length + (storeOrders || []).length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top customers
  const customerSpending: Record<string, { name: string; orders: number; value: number }> = {};
  (orders3D || []).forEach((o: any) => {
    if (!customerSpending[o.user_id]) {
      customerSpending[o.user_id] = { name: o.user_id, orders: 0, value: 0 };
    }
    customerSpending[o.user_id].orders++;
    customerSpending[o.user_id].value += o.final_price || 0;
  });

  const topCustomers = Object.values(customerSpending)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Top products (from store orders)
  const productSales: Record<string, { name: string; sold: number; revenue: number }> = {};
  // Would need order items table for accurate data

  // Cash flow by month (last 6 months)
  const cashFlowByMonth = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(periodEnd, i));
    const monthEnd = endOfMonth(subMonths(periodEnd, i));

    const { data: monthOrders } = await supabase
      .from('orders_3d')
      .select('final_price, material_cost')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const inflow = (monthOrders || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
    const outflow = (monthOrders || []).reduce((sum: number, o: any) => sum + (o.material_cost || 0), 0);

    cashFlowByMonth.push({
      month: format(monthStart, 'MMM', { locale: pl }),
      inflow,
      outflow
    });
  }

  // Utilization
  const workingHoursPerMonth = 22 * 8; // 22 days, 8 hours
  const utilization = workingHoursPerMonth > 0 ? (productionHours / workingHoursPerMonth) * 100 : 0;

  // Forecast
  const avgMonthlyRevenue = cashFlowByMonth.reduce((sum, m) => sum + m.inflow, 0) / 6;
  const forecastRevenue = avgMonthlyRevenue * 1.05; // 5% growth assumption

  return {
    period: { start: periodStart, end: periodEnd },
    company,
    revenue: {
      total: totalRevenue,
      byType: { orders3D: orders3DRevenue, storeOrders: storeOrdersRevenue },
      byMonth: cashFlowByMonth
    },
    expenses,
    profit: {
      gross: grossProfit,
      net: netProfit,
      margin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    },
    vat: {
      input: vatInput,
      output: vatOutput,
      due: vatDue
    },
    orders: {
      total: totalOrders,
      byStatus: orderStatusCounts,
      byPriority: orderPriorityCounts,
      averageValue: averageOrderValue
    },
    customers: {
      total: (profiles || []).length,
      new: newCustomers,
      returning: (profiles || []).length - newCustomers,
      top: topCustomers,
      growth: 0 // Would need historical data
    },
    products: {
      top: [],
      byCategory: {}
    },
    warehouse: {
      totalValue: warehouseValue,
      items: (warehouseItems || []).length,
      lowStock: (warehouseItems || []).filter((i: any) => i.min_quantity && i.quantity < i.min_quantity).length,
      changes: []
    },
    filaments: {
      totalUsed: totalFilamentUsed,
      byMaterial: {},
      byColor: [],
      costPerGram: (() => {
        const pricedFilaments = (filaments || []).filter((filament: any) => Number(filament.price_per_kg || 0) > 0);
        if (pricedFilaments.length === 0) return 0;
        const averagePricePerKg = pricedFilaments.reduce((sum: number, filament: any) => sum + Number(filament.price_per_kg || 0), 0) / pricedFilaments.length;
        return averagePricePerKg / 1000;
      })()
    },
    production: {
      totalHours: productionHours,
      byStatus: orderStatusCounts,
      utilization,
      queueSize: (orders3D || []).filter((o: any) => o.status === 'queued').length
    },
    cashFlow: {
      inflow: totalRevenue,
      outflow: expenses.total,
      balance: grossProfit,
      byMonth: cashFlowByMonth
    },
    analytics: {
      conversionRate: 0,
      averageOrderValue,
      repeatPurchaseRate: 0,
      customerLifetimeValue: 0
    },
    forecast: {
      nextMonthRevenue: forecastRevenue,
      nextMonthOrders: Math.round(totalOrders * 1.05),
      confidence: 'Średnia'
    }
  };
}

async function generateAISummary(data: ReportData): Promise<string> {
  // Try to use AI for analysis
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/ai-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ reportData: data })
    });

    if (response.ok) {
      const result = await response.json();
      return result.analysis;
    }
  } catch (error) {
    console.log('AI analysis not available, using manual analysis');
  }

  // Manual analysis
  const revenueChange = data.revenue.byMonth.length >= 2
    ? ((data.revenue.byMonth[5].inflow - data.revenue.byMonth[4].inflow) / (data.revenue.byMonth[4].inflow || 1)) * 100
    : 0;

  return `RAPORT FINANSOWY - ANALIZA ZAAWANSOWANA

OKRES: ${format(data.period.start, 'd MMMM yyyy', { locale: pl })} - ${format(data.period.end, 'd MMMM yyyy', { locale: pl })}

ANALIZA PRZYCHODÓW
==================
Całkowity przychód: ${data.revenue.total.toFixed(2)} PLN
  - Zamówienia 3D: ${data.revenue.byType.orders3D.toFixed(2)} PLN (${((data.revenue.byType.orders3D / (data.revenue.total || 1)) * 100).toFixed(1)}%)
  - Zamówienia sklepowe: ${data.revenue.byType.storeOrders.toFixed(2)} PLN (${((data.revenue.byType.storeOrders / (data.revenue.total || 1)) * 100).toFixed(1)}%)

Trend przychodów: ${revenueChange >= 0 ? '↑ Wzrost' : '↓ Spadek'} o ${Math.abs(revenueChange).toFixed(1)}%

ANALIZA KOSZTÓW
===============
Całkowite koszty: ${data.expenses.total.toFixed(2)} PLN
  - Materiały: ${data.expenses.materials.toFixed(2)} PLN
  - Energia elektryczna: ${data.expenses.electricity.toFixed(2)} PLN
  - Utrzymanie maszyn: ${data.expenses.maintenance.toFixed(2)} PLN
  - Dostawa: ${data.expenses.shipping.toFixed(2)} PLN
  - Opakowania: ${data.expenses.other.toFixed(2)} PLN

ANALIZA ZYSKÓW
==============
Zysk brutto: ${data.profit.gross.toFixed(2)} PLN
Zysk netto: ${data.profit.net.toFixed(2)} PLN
Marża zysku: ${data.profit.margin.toFixed(1)}%

ANALIZA VAT
===========
VAT należny: ${data.vat.output.toFixed(2)} PLN
VAT naliczony: ${data.vat.input.toFixed(2)} PLN
VAT do zapłaty: ${data.vat.due.toFixed(2)} PLN

ANALIZA PRODUKCJI
================
Godziny pracy maszyn: ${data.production.totalHours.toFixed(1)} h
Wykorzystanie maszyn: ${data.production.utilization.toFixed(1)}%
Zamówienia w kolejce: ${data.production.queueSize}

ANALIZA MAGAZYNU
===============
Wartość magazynu: ${data.warehouse.totalValue.toFixed(2)} PLN
Pozycji w magazynie: ${data.warehouse.items}
Niskie stany: ${data.warehouse.lowStock} pozycji

ANALIZA KLIENTÓW
================
Całkowita liczba klientów: ${data.customers.total}
Nowi klienci: ${data.customers.new}
Powracający klienci: ${data.customers.returning}
Średnia wartość zamówienia: ${data.analytics.averageOrderValue.toFixed(2)} PLN

PROGNOZA NA NASTĘPNY MIESIĄC
===========================
Przewidywany przychód: ${data.forecast.nextMonthRevenue.toFixed(2)} PLN
Przewidywana liczba zamówień: ${data.forecast.nextMonthOrders}
Poziom pewności: ${data.forecast.confidence}

REKOMENDACJE
============
${data.profit.margin < 20 ? '• NISKA MARŻA - Rozważ zwiększenie cen lub optymalizację kosztów' : '• Marża na odpowiednim poziomie'}
${data.production.utilization < 50 ? '• NISKIE WYKORZYSTANIE MASZYN - Rozważ zwiększenie marketingu' : '• Dobre wykorzystanie maszyn'}
${data.warehouse.lowStock > 0 ? `• UWAGA: ${data.warehouse.lowStock} pozycji wymaga uzupełnienia` : '• Stany magazynowe w normie'}
${data.production.queueSize > 10 ? '• DUŻA KOLEJKA - Rozważ zwiększenie mocy produkcyjnych' : '• Kolejka produkcyjna w normie'}

ANALIZA RYZYKA
=============
• Ryzyko płynności: ${data.cashFlow.balance > 0 ? 'NISKIE' : 'WYSOKIE'}
• Ryzyko operacyjne: ${data.production.utilization > 80 ? 'WYSOKIE (przeładowanie)' : 'NISKIE'}
• Ryzyko magazynowe: ${data.warehouse.lowStock > 5 ? 'ŚREDNIE' : 'NISKIE'}

MOŻLIWOŚCI BIZNESOWE
===================
• Rozszerzenie oferty o nowe materiały
• Zwiększenie automatyzacji produkcji
• Wprowadzenie programu lojalnościowego dla stałych klientów
• Rozpoczęcie sprzedaży B2B z terminami płatności

SUGEROWANE DZIAŁANIA
====================
1. Przegląd cen materiałów pod kątem rentowności
2. Analiza klientów z największą wartością
3. Optymalizacja czasu produkcji przez nowe maszyny
4. Uzupełnienie stanów magazynowych`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN'
  }).format(value);
}

async function createExcelReport(data: ReportData, aiSummary: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'KORIX3D';
  workbook.created = new Date();
  workbook.company = data.company.name;

  // Color scheme
  const colors = {
    primary: 'FFFF6A00',
    secondary: 'FF1A1A1A',
    success: 'FF22C55E',
    danger: 'FFEF4444',
    warning: 'FFF59E0B',
    header: 'FF2D2D2D',
    light: 'FFF5F5F5',
    white: 'FFFFFFFF'
  };

  const headerStyle = {
    font: { bold: true, color: { argb: colors.white }, size: 12 },
    fill: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: colors.primary } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
  };

  const subHeaderStyle = {
    font: { bold: true, color: { argb: colors.white }, size: 11 },
    fill: { type: 'pattern' as const, pattern: 'solid', fgColor: { argb: colors.header } },
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const }
  };

  const numberStyle = {
    numFmt: '#,##0.00 "PLN"'
  };

  const percentStyle = {
    numFmt: '0.0%'
  };

  // ==================== SHEET 01: EXECUTIVE SUMMARY ====================
  const sheet1 = workbook.addWorksheet('01 Podsumowanie', {
    views: [{ showGridLines: false }]
  });

  // Company header
  sheet1.mergeCells('A1:H2');
  sheet1.getCell('A1').value = data.company.name;
  sheet1.getCell('A1').style = {
    font: { bold: true, size: 24, color: { argb: colors.secondary } },
    alignment: { horizontal: 'center', vertical: 'middle' }
  };

  sheet1.mergeCells('A3:H3');
  sheet1.getCell('A3').value = `RAPORT FINANSOWY | ${format(data.period.start, 'MMMM yyyy', { locale: pl })}`;
  sheet1.getCell('A3').style = {
    font: { size: 14, color: { argb: 'FF666666' } },
    alignment: { horizontal: 'center' }
  };

  // KPI Cards
  const kpiStartRow = 5;
  const kpis = [
    { label: 'Przychód całkowity', value: formatCurrency(data.revenue.total), color: colors.primary },
    { label: 'Zysk brutto', value: formatCurrency(data.profit.gross), color: data.profit.gross >= 0 ? colors.success : colors.danger },
    { label: 'Marża', value: `${data.profit.margin.toFixed(1)}%`, color: data.profit.margin >= 20 ? colors.success : colors.warning },
    { label: 'Zamówienia', value: data.orders.total.toString(), color: colors.primary }
  ];

  kpis.forEach((kpi, i) => {
    const col = String.fromCharCode(65 + i * 2); // A, C, E, G
    sheet1.mergeCells(`${col}${kpiStartRow}:${String.fromCharCode(65 + i * 2 + 1)}${kpiStartRow + 1}`);
    sheet1.getCell(`${col}${kpiStartRow}`).value = kpi.label;
    sheet1.getCell(`${col}${kpiStartRow}`).style = subHeaderStyle as any as any;
    sheet1.mergeCells(`${col}${kpiStartRow + 2}:${String.fromCharCode(65 + i * 2 + 1)}${kpiStartRow + 2}`);
    sheet1.getCell(`${col}${kpiStartRow + 2}`).value = kpi.value;
    sheet1.getCell(`${col}${kpiStartRow + 2}`).style = {
      font: { bold: true, size: 18, color: { argb: kpi.color } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    } as any;
  });

  // Revenue vs Expenses
  sheet1.getCell(`A${kpiStartRow + 5}`).value = 'PRZYCHODY vs KOSZTY';
  sheet1.getCell(`A${kpiStartRow + 5}`).style = headerStyle as any;
  sheet1.mergeCells(`A${kpiStartRow + 5}:H${kpiStartRow + 5}`);

  const revExpData = [
    ['Przychody', data.revenue.total, '100%'],
    ['  - Zamówienia 3D', data.revenue.byType.orders3D, `${((data.revenue.byType.orders3D / (data.revenue.total || 1)) * 100).toFixed(1)}%`],
    ['  - Sklep', data.revenue.byType.storeOrders, `${((data.revenue.byType.storeOrders / (data.revenue.total || 1)) * 100).toFixed(1)}%`],
    ['Koszty', data.expenses.total, `${((data.expenses.total / (data.revenue.total || 1)) * 100).toFixed(1)}%`],
    ['Zysk brutto', data.profit.gross, `${data.profit.margin.toFixed(1)}%`]
  ];

  revExpData.forEach((row, i) => {
    const rowNum = kpiStartRow + 6 + i;
    sheet1.getCell(`A${rowNum}`).value = row[0];
    sheet1.getCell(`B${rowNum}`).value = row[1];
    sheet1.getCell(`B${rowNum}`).style = numberStyle as any;
    sheet1.getCell(`C${rowNum}`).value = row[2];
  });

  // Column widths
  sheet1.columns.forEach(col => col.width = 20);

  // ==================== SHEET 02: REVENUE ====================
  const sheet2 = workbook.addWorksheet('02 Przychody');
  sheet2.getCell('A1').value = 'SZCZEGÓŁOWY RAPORT PRZYCHODÓW';
  sheet2.getCell('A1').style = headerStyle as any;
  sheet2.mergeCells('A1:F1');

  sheet2.getCell('A3').value = 'Miesiąc';
  sheet2.getCell('B3').value = 'Przychód';
  sheet2.getCell('C3').value = 'Zmiana';
  [3, 3, 3].forEach((col, i) => {
    sheet2.getCell(1, i + 1).style = subHeaderStyle as any;
  });

  let prevRevenue = 0;
  data.revenue.byMonth.forEach((m, i) => {
    const row = 4 + i;
    sheet2.getCell(`A${row}`).value = m.month;
    sheet2.getCell(`B${row}`).value = m.inflow;
    sheet2.getCell(`B${row}`).style = numberStyle as any;
    const change = prevRevenue > 0 ? ((m.inflow - prevRevenue) / prevRevenue) : 0;
    sheet2.getCell(`C${row}`).value = change;
    sheet2.getCell(`C${row}`).style = percentStyle as any;
    prevRevenue = m.inflow;
  });

  sheet2.columns.forEach(col => col.width = 18);

  // ==================== SHEET 03: EXPENSES ====================
  const sheet3 = workbook.addWorksheet('03 Koszty');
  sheet3.getCell('A1').value = 'SZCZEGÓŁOWY RAPORT KOSZTÓW';
  sheet3.getCell('A1').style = headerStyle as any;
  sheet3.mergeCells('A1:D1');

  const expenseData = [
    ['Materiały', data.expenses.materials],
    ['Energia elektryczna', data.expenses.electricity],
    ['Utrzymanie maszyn', data.expenses.maintenance],
    ['Dostawa', data.expenses.shipping],
    ['Inne', data.expenses.other],
    ['RAZEM', data.expenses.total]
  ];

  sheet3.getCell('A3').value = 'Kategoria';
  sheet3.getCell('B3').value = 'Kwota';
  sheet3.getCell('C3').value = 'Udział';
  ['A', 'B', 'C'].forEach(col => {
    sheet3.getCell(`${col}3`).style = subHeaderStyle as any;
  });

  expenseData.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet3.getCell(`A${rowNum}`).value = row[0];
    sheet3.getCell(`B${rowNum}`).value = row[1] as number;
    sheet3.getCell(`B${rowNum}`).style = numberStyle as any;
    sheet3.getCell(`C${rowNum}`).value = (row[1] as number) / (data.expenses.total || 1);
    sheet3.getCell(`C${rowNum}`).style = percentStyle as any as any;
    if (row[0] === 'RAZEM') {
      sheet3.getCell(`A${rowNum}`).style = { font: { bold: true } } as any;
      sheet3.getCell(`B${rowNum}`).style = { ...numberStyle, font: { bold: true } } as any;
    }
  });

  sheet3.columns.forEach(col => col.width = 20);

  // ==================== SHEET 04: PROFIT ====================
  const sheet4 = workbook.addWorksheet('04 Zysk');
  sheet4.getCell('A1').value = 'ANALIZA ZYSKÓW';
  sheet4.getCell('A1').style = headerStyle as any;
  sheet4.mergeCells('A1:C1');

  const profitData = [
    ['Przychód brutto', data.revenue.total],
    ['VAT należny', -data.vat.output],
    ['Przychód netto', data.revenue.total - data.vat.output],
    ['Koszty', -data.expenses.total],
    ['Zysk brutto', data.profit.gross],
    ['VAT naliczony', -data.vat.input],
    ['Zysk netto', data.profit.net],
    ['Marża zysku', data.profit.margin / 100]
  ];

  sheet4.getCell('A3').value = 'Pozycja';
  sheet4.getCell('B3').value = 'Wartość';
  ['A', 'B'].forEach(col => {
    sheet4.getCell(`${col}3`).style = subHeaderStyle as any;
  });

  profitData.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet4.getCell(`A${rowNum}`).value = row[0];
    if (row[0] === 'Marża zysku') {
      sheet4.getCell(`B${rowNum}`).value = row[1];
      sheet4.getCell(`B${rowNum}`).style = percentStyle as any;
    } else {
      sheet4.getCell(`B${rowNum}`).value = row[1];
      sheet4.getCell(`B${rowNum}`).style = numberStyle as any;
    }
  });

  sheet4.columns.forEach(col => col.width = 22);

  // ==================== SHEET 05: VAT ====================
  const sheet5 = workbook.addWorksheet('05 VAT');
  sheet5.getCell('A1').value = 'ANALIZA PODATKU VAT';
  sheet5.getCell('A1').style = headerStyle as any;
  sheet5.mergeCells('A1:C1');

  const vatData = [
    ['VAT należny (sprzedaż)', data.vat.output],
    ['VAT naliczony (zakup)', data.vat.input],
    ['VAT do zapłaty', data.vat.due]
  ];

  sheet5.getCell('A3').value = 'Pozycja';
  sheet5.getCell('B3').value = 'Kwota';
  ['A', 'B'].forEach(col => {
    sheet5.getCell(`${col}3`).style = subHeaderStyle as any;
  });

  vatData.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet5.getCell(`A${rowNum}`).value = row[0];
    sheet5.getCell(`B${rowNum}`).value = row[1];
    sheet5.getCell(`B${rowNum}`).style = numberStyle as any;
  });

  sheet5.columns.forEach(col => col.width = 25);

  // ==================== SHEET 06: ORDERS ====================
  const sheet6 = workbook.addWorksheet('06 Zamówienia');
  sheet6.getCell('A1').value = 'ANALIZA ZAMÓWIEŃ';
  sheet6.getCell('A1').style = headerStyle as any;
  sheet6.mergeCells('A1:D1');

  sheet6.getCell('A3').value = 'Statystyka zamówień';
  sheet6.getCell('A3').style = subHeaderStyle as any;
  sheet6.mergeCells('A3:D3');

  const orderStats: Array<[string, number]> = [
    ['Całkowita liczba zamówień', data.orders.total],
    ['Średnia wartość zamówienia', data.orders.averageValue],
    ['Zamówienia 3D', Object.values(data.orders.byStatus).reduce((a: number, b: number) => a + b, 0)],
    ['Zamówienia w kolejce', data.orders.byStatus['new'] || 0],
    ['W trakcie realizacji', (data.orders.byStatus['printing'] || 0) + (data.orders.byStatus['queued'] || 0)],
    ['Zakończone', data.orders.byStatus['completed'] || 0]
  ];

  orderStats.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet6.getCell(`A${rowNum}`).value = row[0];
    if (row[0].includes('wartość')) {
      sheet6.getCell(`B${rowNum}`).value = row[1];
      sheet6.getCell(`B${rowNum}`).style = numberStyle as any;
    } else {
      sheet6.getCell(`B${rowNum}`).value = row[1];
    }
  });

  // Status breakdown
  sheet6.getCell('A12').value = 'Status zamówień';
  sheet6.getCell('A12').style = subHeaderStyle as any;
  Object.entries(data.orders.byStatus).forEach(([status, count], i) => {
    const rowNum = 13 + i;
    sheet6.getCell(`A${rowNum}`).value = status;
    sheet6.getCell(`B${rowNum}`).value = count;
  });

  sheet6.columns.forEach(col => col.width = 28);

  // ==================== SHEET 07: CUSTOMERS ====================
  const sheet7 = workbook.addWorksheet('07 Klienci');
  sheet7.getCell('A1').value = 'ANALIZA KLIENTÓW';
  sheet7.getCell('A1').style = headerStyle as any;
  sheet7.mergeCells('A1:D1');

  const customerStats = [
    ['Całkowita liczba klientów', data.customers.total],
    ['Nowi klienci', data.customers.new],
    ['Powracający klienci', data.customers.returning]
  ];

  sheet7.getCell('A3').value = 'Statystyki';
  sheet7.getCell('A3').style = subHeaderStyle as any;

  customerStats.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet7.getCell(`A${rowNum}`).value = row[0];
    sheet7.getCell(`B${rowNum}`).value = row[1];
  });

  // Top customers
  sheet7.getCell('A9').value = 'Najlepsi klienci';
  sheet7.getCell('A9').style = subHeaderStyle as any;
  sheet7.mergeCells('A9:D9');

  ['Klient', 'Zamówienia', 'Wartość'].forEach((header, i) => {
    sheet7.getCell(String.fromCharCode(65 + i) + 10).value = header;
    sheet7.getCell(String.fromCharCode(65 + i) + 10).style = subHeaderStyle as any;
  });

  data.customers.top.forEach((customer, i) => {
    const rowNum = 11 + i;
    sheet7.getCell(`A${rowNum}`).value = customer.name;
    sheet7.getCell(`B${rowNum}`).value = customer.orders;
    sheet7.getCell(`C${rowNum}`).value = customer.value;
    sheet7.getCell(`C${rowNum}`).style = numberStyle as any;
  });

  sheet7.columns.forEach(col => col.width = 20);

  // ==================== SHEET 08: PRODUCTS ====================
  const sheet8 = workbook.addWorksheet('08 Produkty');
  sheet8.getCell('A1').value = 'ANALIZA PRODUKTÓW';
  sheet8.getCell('A1').style = headerStyle as any;
  sheet8.mergeCells('A1:D1');

  sheet8.getCell('A3').value = 'Top produkty będą dostępne po integracji z danymi sprzedażowymi';
  sheet8.columns.forEach(col => col.width = 20);

  // ==================== SHEET 09: WAREHOUSE ====================
  const sheet9 = workbook.addWorksheet('09 Magazyn');
  sheet9.getCell('A1').value = 'ANALIZA MAGAZYNU';
  sheet9.getCell('A1').style = headerStyle as any;
  sheet9.mergeCells('A1:D1');

  const warehouseStats = [
    ['Wartość magazynu', data.warehouse.totalValue],
    ['Liczba pozycji', data.warehouse.items],
    ['Niskie stany', data.warehouse.lowStock]
  ];

  sheet9.getCell('A3').value = 'Statystyki magazynowe';
  sheet9.getCell('A3').style = subHeaderStyle as any;

  warehouseStats.forEach((row, i) => {
    const rowNum = 4 + i;
    sheet9.getCell(`A${rowNum}`).value = row[0];
    if (row[0] === 'Wartość magazynu') {
      sheet9.getCell(`B${rowNum}`).value = row[1] as number;
      sheet9.getCell(`B${rowNum}`).style = numberStyle as any;
    } else {
      sheet9.getCell(`B${rowNum}`).value = row[1];
    }
  });

  sheet9.columns.forEach(col => col.width = 22);

  // ==================== SHEET 10: FILAMENTS ====================
  const sheet10 = workbook.addWorksheet('10 Filamenty');
  sheet10.getCell('A1').value = 'ANALIZA UŻYCIA FILAMENTÓW';
  sheet10.getCell('A1').style = headerStyle as any;
  sheet10.mergeCells('A1:D1');

  sheet10.getCell('A3').value = 'Całkowite zużycie filamentu (gramy)';
  sheet10.getCell('A4').value = data.filaments.totalUsed;
  sheet10.getCell('A5').value = 'Koszt na gram';
  sheet10.getCell(`B5`).value = data.filaments.costPerGram;
  sheet10.getCell(`B5`).style = { numFmt: '#,##0.0000 "PLN"' };

  sheet10.columns.forEach(col => col.width = 25);

  // ==================== SHEET 11: PRODUCTION ====================
  const sheet11 = workbook.addWorksheet('11 Produkcja');
  sheet11.getCell('A1').value = 'ANALIZA PRODUKCJI';
  sheet11.getCell('A1').style = headerStyle as any;
  sheet11.mergeCells('A1:D1');

  const productionStats = [
    ['Godziny pracy maszyn', `${data.production.totalHours} h`],
    ['Wykorzystanie maszyn', `${data.production.utilization.toFixed(1)}%`],
    ['Zamówienia w kolejce', data.production.queueSize]
  ];

  productionStats.forEach((row, i) => {
    const rowNum = 3 + i;
    sheet11.getCell(`A${rowNum}`).value = row[0];
    sheet11.getCell(`B${rowNum}`).value = row[1];
  });

  sheet11.columns.forEach(col => col.width = 25);

  // ==================== SHEET 12: CASH FLOW ====================
  const sheet12 = workbook.addWorksheet('12 Przepływ gotówki');
  sheet12.getCell('A1').value = 'ANALIZA PRZEPŁYWU GOTÓWKI';
  sheet12.getCell('A1').style = headerStyle as any;
  sheet12.mergeCells('A1:D1');

  ['Miesiąc', 'Wpływy', 'Wypływy', 'Bilans'].forEach((header, i) => {
    sheet12.getCell(String.fromCharCode(65 + i) + 3).value = header;
    sheet12.getCell(String.fromCharCode(65 + i) + 3).style = subHeaderStyle as any;
  });

  data.cashFlow.byMonth.forEach((m, i) => {
    const rowNum = 4 + i;
    sheet12.getCell(`A${rowNum}`).value = m.month;
    sheet12.getCell(`B${rowNum}`).value = m.inflow;
    sheet12.getCell(`B${rowNum}`).style = numberStyle as any;
    sheet12.getCell(`C${rowNum}`).value = m.outflow;
    sheet12.getCell(`C${rowNum}`).style = numberStyle as any;
    sheet12.getCell(`D${rowNum}`).value = m.inflow - m.outflow;
    sheet12.getCell(`D${rowNum}`).style = numberStyle as any;
  });

  sheet12.columns.forEach(col => col.width = 18);

  // ==================== SHEET 13: ANALYTICS ====================
  const sheet13 = workbook.addWorksheet('13 Analityka');
  sheet13.getCell('A1').value = 'ANALITYKA BIZNESOWA';
  sheet13.getCell('A1').style = headerStyle as any;
  sheet13.mergeCells('A1:C1');

  const analyticsData = [
    ['Średnia wartość zamówienia', data.analytics.averageOrderValue],
    ['Współczynnik konwersji', `${data.analytics.conversionRate}%`],
    ['Wskaźnik powrotów', `${data.analytics.repeatPurchaseRate}%`],
    ['Wartość życiowa klienta', data.analytics.customerLifetimeValue]
  ];

  analyticsData.forEach((row, i) => {
    const rowNum = 3 + i;
    sheet13.getCell(`A${rowNum}`).value = row[0];
    sheet13.getCell(`B${rowNum}`).value = row[1];
  });

  sheet13.columns.forEach(col => col.width = 28);

  // ==================== SHEET 14: FORECAST ====================
  const sheet14 = workbook.addWorksheet('14 Prognoza');
  sheet14.getCell('A1').value = 'PROGNOZA NA NASTĘPNY MIESIĄC';
  sheet14.getCell('A1').style = headerStyle as any;
  sheet14.mergeCells('A1:C1');

  const forecastData = [
    ['Przewidywany przychód', data.forecast.nextMonthRevenue],
    ['Przewidywana liczba zamówień', data.forecast.nextMonthOrders],
    ['Poziom pewności', data.forecast.confidence]
  ];

  forecastData.forEach((row, i) => {
    const rowNum = 3 + i;
    sheet14.getCell(`A${rowNum}`).value = row[0];
    if (typeof row[1] === 'number') {
      sheet14.getCell(`B${rowNum}`).value = row[1];
      sheet14.getCell(`B${rowNum}`).style = numberStyle as any;
    } else {
      sheet14.getCell(`B${rowNum}`).value = row[1];
    }
  });

  sheet14.columns.forEach(col => col.width = 28);

  // ==================== SHEET 15: AI ANALYSIS ====================
  const sheet15 = workbook.addWorksheet('15 Analiza AI');
  sheet15.getCell('A1').value = 'ANALIZA FINANSOWA AI';
  sheet15.getCell('A1').style = headerStyle as any;
  sheet15.mergeCells('A1:A1');

  // Split AI summary into lines
  const lines = aiSummary.split('\n');
  lines.forEach((line, i) => {
    const rowNum = 3 + i;
    const cell = sheet15.getCell(`A${rowNum}`);
    cell.value = line;
    if (line.includes('===')) {
      cell.style = { font: { bold: true, color: { argb: colors.primary } } };
    } else if (line.trim().startsWith('•')) {
      cell.style = { font: { italic: true } };
    }
  });

  sheet15.columns.forEach(col => col.width = 80);

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateAccountingReport(
  year: number,
  month: number,
  generatedBy?: string
): Promise<{ fileName: string; filePath: string; fileSize: number }> {
  const supabase = getSupabaseAdmin();

  const periodStart = startOfMonth(new Date(year, month - 1));
  const periodEnd = endOfMonth(new Date(year, month - 1));

  // Check if report already exists
  const { data: existingReport } = await supabase
    .from('accounting_reports')
    .select('*')
    .eq('report_month', periodStart.toISOString().split('T')[0])
    .single();

  if (existingReport) {
    throw new Error(`Raport dla ${format(periodStart, 'MMMM yyyy', { locale: pl })} już istnieje`);
  }

  // Fetch data
  const reportData = await fetchReportData(periodStart, periodEnd);

  // Generate AI summary
  const aiSummary = await generateAISummary(reportData);

  // Create Excel file
  const excelBuffer = await createExcelReport(reportData, aiSummary);

  // Upload to storage
  const fileName = `KORIX3D_Raport_${format(periodStart, 'yyyy-MM', { locale: pl })}.xlsx`;
  const filePath = `${year}/${month}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('accounting-reports')
    .upload(filePath, excelBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

  if (uploadError) {
    throw new Error(`Błąd zapisu pliku: ${uploadError.message}`);
  }

  // Save metadata to database
  const { data: report, error: insertError } = await supabase
    .from('accounting_reports')
    .insert({
      report_month: periodStart,
      report_year: year,
      report_type: 'monthly',
      file_name: fileName,
      file_path: filePath,
      file_size: excelBuffer.length,
      status: 'generated',
      generated_by: generatedBy || null,
      summary: {
        revenue: reportData.revenue.total,
        expenses: reportData.expenses.total,
        profit: reportData.profit.gross,
        margin: reportData.profit.margin
      }
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Błąd zapisu metadanych: ${insertError.message}`);
  }

  return {
    fileName,
    filePath,
    fileSize: excelBuffer.length
  };
}

export { fetchReportData, createExcelReport, generateAISummary };
export type { ReportData };
