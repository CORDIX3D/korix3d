import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { pl } from 'date-fns/locale';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(url, key);
}

interface ExecutiveData {
  period: { start: Date; end: Date };
  revenue: {
    total: number;
    previousMonth: number;
    change: number;
    byType: { orders3D: number; storeOrders: number };
    byMonth: Array<{ month: string; amount: number }>;
  };
  expenses: {
    total: number;
    previousMonth: number;
    change: number;
    breakdown: { materials: number; electricity: number; maintenance: number; shipping: number; other: number };
  };
  profit: {
    gross: number;
    previousMonth: number;
    margin: number;
    previousMargin: number;
  };
  orders: {
    total: number;
    previousMonth: number;
    averageValue: number;
    byPriority: { standard: number; express: number; urgent: number };
    completionRate: number;
  };
  production: {
    totalHours: number;
    utilization: number;
    queueSize: number;
    avgPrintTime: number;
  };
  warehouse: {
    totalValue: number;
    items: number;
    lowStock: number;
    lowStockItems: Array<{ name: string; quantity: number; minQuantity: number }>;
  };
  filaments: {
    totalUsed: number;
    byMaterial: Record<string, number>;
    byColor: Array<{ color: string; grams: number }>;
    lowStock: Array<{ material: string; color: string; remaining: number }>;
  };
  customers: {
    total: number;
    new: number;
    returning: number;
    top: Array<{ name: string; orders: number; value: number }>;
    retentionRate: number;
  };
  topProducts: Array<{ name: string; sold: number; revenue: number; margin: number }>;
  topMaterials: Array<{ name: string; sold: number; revenue: number; margin: number }>;
}

interface CompanyScores {
  financialHealth: number;
  productionEfficiency: number;
  warehouseManagement: number;
  customerSatisfaction: number;
  businessGrowth: number;
  overallScore: number;
}

interface Insight {
  type: 'positive' | 'warning' | 'critical' | 'info';
  category: string;
  title: string;
  description: string;
  value?: number;
  change?: number;
  recommendation?: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  expectedImpact: string;
  details: string;
}

interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  probability: number;
  impact: string;
  mitigation: string;
}

interface Forecast {
  revenue: { value: number; confidence: number };
  profit: { value: number; confidence: number };
  orders: { value: number; confidence: number };
  assumptions: string[];
}

interface ExecutiveReport {
  summary: string;
  scores: CompanyScores;
  insights: Insight[];
  recommendations: Recommendation[];
  risks: Risk[];
  forecast: Forecast;
  ceoComment: string;
  notifications: Array<{ type: string; title: string; message: string; priority: string }>;
}

async function fetchExecutiveData(periodStart: Date, periodEnd: Date): Promise<ExecutiveData> {
  const supabase = getSupabaseAdmin();

  const prevPeriodStart = subMonths(periodStart, 1);
  const prevPeriodEnd = subMonths(periodEnd, 1);

  // Fetch all data in parallel
  const [
    { data: settings },
    { data: orders3DCurrent },
    { data: orders3DPrevious },
    { data: storeOrdersCurrent },
    { data: storeOrdersPrevious },
    { data: filaments },
    { data: filamentUsage },
    { data: warehouseItems },
    { data: materials },
    { data: profiles }
  ] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('orders_3d').select('*').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
    supabase.from('orders_3d').select('*').gte('created_at', prevPeriodStart.toISOString()).lte('created_at', prevPeriodEnd.toISOString()),
    supabase.from('store_orders').select('*').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
    supabase.from('store_orders').select('*').gte('created_at', prevPeriodStart.toISOString()).lte('created_at', prevPeriodEnd.toISOString()),
    supabase.from('filaments').select('*'),
    supabase.from('filament_usage_log').select('*').gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
    supabase.from('warehouse_items').select('*'),
    supabase.from('materials').select('*'),
    supabase.from('profiles').select('id, full_name, email, role, created_at')
  ]);

  const settingsMap: Record<string, string> = {};
  (settings || []).forEach((s: any) => {
    settingsMap[s.key] = s.value || '';
  });

  // Calculate revenue
  const orders3DRevenue = (orders3DCurrent || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
  const storeOrdersRevenue = (storeOrdersCurrent || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const totalRevenue = orders3DRevenue + storeOrdersRevenue;

  const prevOrders3DRevenue = (orders3DPrevious || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
  const prevStoreOrdersRevenue = (storeOrdersPrevious || []).reduce((sum: number, o: any) => sum + (o.total || 0), 0);
  const prevTotalRevenue = prevOrders3DRevenue + prevStoreOrdersRevenue;

  const revenueChange = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;

  // Calculate production hours and costs
  const productionHours = (orders3DCurrent || []).reduce((sum: number, o: any) => sum + (o.printing_time_hours || 0), 0);
  const prevProductionHours = (orders3DPrevious || []).reduce((sum: number, o: any) => sum + (o.printing_time_hours || 0), 0);

  const electricityCost = parseFloat(settingsMap.electricity_hour_cost || '2') * productionHours;
  const maintenanceCost = parseFloat(settingsMap.maintenance_hour_cost || '5') * productionHours;
  const materialCosts = (orders3DCurrent || []).reduce((sum: number, o: any) => sum + (o.material_cost || 0), 0);
  const prevMaterialCosts = (orders3DPrevious || []).reduce((sum: number, o: any) => sum + (o.material_cost || 0), 0);
  const defaultShippingCost = parseFloat(settingsMap.courier_price || settingsMap.shipping_cost || '15');
  const shippingCost3D = (orders3DCurrent || []).filter((o: any) => ['shipped', 'completed'].includes(o.status)).length * defaultShippingCost;
  const shippingCostStore = (storeOrdersCurrent || [])
    .filter((o: any) => ['shipped', 'delivered'].includes(o.status))
    .reduce((sum: number, o: any) => sum + Number(o.shipping_cost || 0), 0);
  const shippingCost = shippingCost3D + shippingCostStore;
  const prevShippingCost3D = (orders3DPrevious || []).filter((o: any) => ['shipped', 'completed'].includes(o.status)).length * defaultShippingCost;
  const prevShippingCostStore = (storeOrdersPrevious || [])
    .filter((o: any) => ['shipped', 'delivered'].includes(o.status))
    .reduce((sum: number, o: any) => sum + Number(o.shipping_cost || 0), 0);
  const prevShippingCost = prevShippingCost3D + prevShippingCostStore;
  const packagingCost = parseFloat(settingsMap.packaging_cost || '5') * ((orders3DCurrent || []).length);

  const totalExpenses = materialCosts + electricityCost + maintenanceCost + shippingCost + packagingCost;
  const prevTotalExpenses = prevMaterialCosts +
    (parseFloat(settingsMap.electricity_hour_cost || '2') * prevProductionHours) +
    (parseFloat(settingsMap.maintenance_hour_cost || '5') * prevProductionHours) +
    prevShippingCost;

  const expensesChange = prevTotalExpenses > 0 ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100 : 0;

  // Profit calculations
  const grossProfit = totalRevenue - totalExpenses;
  const prevGrossProfit = prevTotalRevenue - prevTotalExpenses;
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const prevMargin = prevTotalRevenue > 0 ? (prevGrossProfit / prevTotalRevenue) * 100 : 0;

  // Order statistics
  const totalOrders = (orders3DCurrent || []).length + (storeOrdersCurrent || []).length;
  const prevTotalOrders = (orders3DPrevious || []).length + (storeOrdersPrevious || []).length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const priorityCounts = { standard: 0, express: 0, urgent: 0 };
  (orders3DCurrent || []).forEach((o: any) => {
    if (o.priority === 'standard') priorityCounts.standard++;
    else if (o.priority === 'express') priorityCounts.express++;
    else if (o.priority === 'urgent') priorityCounts.urgent++;
  });

  const completedOrders = (orders3DCurrent || []).filter((o: any) => o.status === 'completed').length +
                          (storeOrdersCurrent || []).filter((o: any) => o.status === 'delivered').length;
  const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

  // Production metrics
  const workingHoursPerMonth = 22 * 8;
  const utilization = (productionHours / workingHoursPerMonth) * 100;
  const queueSize = (orders3DCurrent || []).filter((o: any) => o.status === 'queued' || o.status === 'new').length;
  const avgPrintTime = (orders3DCurrent || []).length > 0
    ? productionHours / (orders3DCurrent || []).length
    : 0;

  // Warehouse metrics
  const warehouseValue = (warehouseItems || []).reduce(
    (sum: number, item: any) => sum + (item.quantity || 0) * (item.purchase_price || 0),
    0
  );
  const lowStockItems = (warehouseItems || [])
    .filter((i: any) => i.min_quantity && i.quantity < i.min_quantity)
    .map((i: any) => ({ name: i.name, quantity: i.quantity, minQuantity: i.min_quantity }));

  // Filament metrics
  const totalFilamentUsed = (filamentUsage || []).reduce((sum: number, f: any) => sum + (f.grams_used || 0), 0);
  const filamentByMaterial: Record<string, number> = {};
  (filamentUsage || []).forEach((f: any) => {
    const material = f.material_name || 'Unknown';
    filamentByMaterial[material] = (filamentByMaterial[material] || 0) + (f.grams_used || 0);
  });

  const lowStockFilaments = (filaments || [])
    .filter((f: any) => f.min_weight_grams && f.remaining_weight_grams < f.min_weight_grams)
    .map((f: any) => ({ material: f.material_name, color: f.color, remaining: f.remaining_weight_grams }));

  // Customer metrics
  const customers = (profiles || []).filter((p: any) => p.role === 'customer');
  const newCustomers = customers.filter((p: any) => {
    const created = new Date(p.created_at);
    return created >= periodStart && created <= periodEnd;
  }).length;

  const returningCustomers = (orders3DCurrent || []).reduce((set: Set<string>, o: any) => {
    if (o.user_id) set.add(o.user_id);
    return set;
  }, new Set()).size;

  const customerSpending: Record<string, { name: string; orders: number; value: number }> = {};
  (orders3DCurrent || []).forEach((o: any) => {
    if (!o.user_id) return;
    if (!customerSpending[o.user_id]) {
      customerSpending[o.user_id] = { name: o.user_id, orders: 0, value: 0 };
    }
    customerSpending[o.user_id].orders++;
    customerSpending[o.user_id].value += o.final_price || 0;
  });

  const topCustomers = Object.values(customerSpending)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const retentionRate = customers.length > 0 ? (returningCustomers / customers.length) * 100 : 0;

  // Top products/materials
  const productRevenue: Record<string, { sold: number; revenue: number; cost: number }> = {};
  (orders3DCurrent || []).forEach((o: any) => {
    const material = o.material_name || 'Unknown';
    if (!productRevenue[material]) {
      productRevenue[material] = { sold: 0, revenue: 0, cost: 0 };
    }
    productRevenue[material].sold += o.quantity || 1;
    productRevenue[material].revenue += o.final_price || 0;
    productRevenue[material].cost += o.material_cost || 0;
  });

  const topProducts = Object.entries(productRevenue)
    .map(([name, data]) => ({
      name,
      sold: data.sold,
      revenue: data.revenue,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Revenue by month (last 6 months)
  const revenueByMonth = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(periodEnd, i));
    const monthEnd = endOfMonth(subMonths(periodEnd, i));

    const { data: monthOrders } = await supabase
      .from('orders_3d')
      .select('final_price')
      .gte('created_at', monthStart.toISOString())
      .lte('created_at', monthEnd.toISOString());

    const monthRevenue = (monthOrders || []).reduce((sum: number, o: any) => sum + (o.final_price || 0), 0);
    revenueByMonth.push({
      month: format(monthStart, 'MMM', { locale: pl }),
      amount: monthRevenue
    });
  }

  return {
    period: { start: periodStart, end: periodEnd },
    revenue: {
      total: totalRevenue,
      previousMonth: prevTotalRevenue,
      change: revenueChange,
      byType: { orders3D: orders3DRevenue, storeOrders: storeOrdersRevenue },
      byMonth: revenueByMonth
    },
    expenses: {
      total: totalExpenses,
      previousMonth: prevTotalExpenses,
      change: expensesChange,
      breakdown: {
        materials: materialCosts,
        electricity: electricityCost,
        maintenance: maintenanceCost,
        shipping: shippingCost,
        other: packagingCost
      }
    },
    profit: {
      gross: grossProfit,
      previousMonth: prevGrossProfit,
      margin,
      previousMargin: prevMargin
    },
    orders: {
      total: totalOrders,
      previousMonth: prevTotalOrders,
      averageValue: averageOrderValue,
      byPriority: priorityCounts,
      completionRate
    },
    production: {
      totalHours: productionHours,
      utilization,
      queueSize,
      avgPrintTime
    },
    warehouse: {
      totalValue: warehouseValue,
      items: (warehouseItems || []).length,
      lowStock: lowStockItems.length,
      lowStockItems
    },
    filaments: {
      totalUsed: totalFilamentUsed,
      byMaterial: filamentByMaterial,
      byColor: [],
      lowStock: lowStockFilaments
    },
    customers: {
      total: customers.length,
      new: newCustomers,
      returning: returningCustomers,
      top: topCustomers,
      retentionRate
    },
    topProducts,
    topMaterials: topProducts
  };
}

function calculateScores(data: ExecutiveData): CompanyScores {
  // Financial Health (0-100)
  let financialHealth = 50;
  if (data.profit.margin >= 30) financialHealth += 25;
  else if (data.profit.margin >= 20) financialHealth += 15;
  else if (data.profit.margin >= 10) financialHealth += 5;
  else if (data.profit.margin < 0) financialHealth -= 20;

  if (data.revenue.change > 20) financialHealth += 15;
  else if (data.revenue.change > 10) financialHealth += 10;
  else if (data.revenue.change > 0) financialHealth += 5;
  else if (data.revenue.change < -10) financialHealth -= 15;

  if (data.profit.gross > 0) financialHealth += 10;
  else financialHealth -= 10;

  financialHealth = Math.max(0, Math.min(100, financialHealth));

  // Production Efficiency (0-100)
  let productionEfficiency = 50;
  if (data.production.utilization >= 80) productionEfficiency += 20;
  else if (data.production.utilization >= 60) productionEfficiency += 10;
  else if (data.production.utilization >= 40) productionEfficiency += 5;
  else if (data.production.utilization < 30) productionEfficiency -= 10;

  if (data.orders.completionRate >= 95) productionEfficiency += 15;
  else if (data.orders.completionRate >= 85) productionEfficiency += 10;
  else if (data.orders.completionRate < 70) productionEfficiency -= 10;

  if (data.production.queueSize <= 5) productionEfficiency += 15;
  else if (data.production.queueSize <= 10) productionEfficiency += 5;
  else if (data.production.queueSize > 20) productionEfficiency -= 10;

  productionEfficiency = Math.max(0, Math.min(100, productionEfficiency));

  // Warehouse Management (0-100)
  let warehouseManagement = 70;
  if (data.warehouse.lowStock === 0) warehouseManagement += 20;
  else if (data.warehouse.lowStock <= 3) warehouseManagement += 10;
  else if (data.warehouse.lowStock > 10) warehouseManagement -= 20;
  else if (data.warehouse.lowStock > 5) warehouseManagement -= 10;

  if (data.filaments.lowStock.length === 0) warehouseManagement += 10;
  else if (data.filaments.lowStock.length > 3) warehouseManagement -= 10;

  warehouseManagement = Math.max(0, Math.min(100, warehouseManagement));

  // Customer Satisfaction (0-100)
  let customerSatisfaction = 60;
  if (data.customers.retentionRate >= 40) customerSatisfaction += 20;
  else if (data.customers.retentionRate >= 25) customerSatisfaction += 10;
  else if (data.customers.retentionRate < 10) customerSatisfaction -= 10;

  if (data.orders.completionRate >= 95) customerSatisfaction += 10;
  else if (data.orders.completionRate < 80) customerSatisfaction -= 10;

  if (data.customers.new > 0) customerSatisfaction += 10;

  customerSatisfaction = Math.max(0, Math.min(100, customerSatisfaction));

  // Business Growth (0-100)
  let businessGrowth = 50;
  if (data.revenue.change > 30) businessGrowth += 25;
  else if (data.revenue.change > 15) businessGrowth += 15;
  else if (data.revenue.change > 5) businessGrowth += 10;
  else if (data.revenue.change < -10) businessGrowth -= 20;

  if (data.customers.new > 5) businessGrowth += 15;
  else if (data.customers.new > 2) businessGrowth += 10;
  else if (data.customers.new === 0) businessGrowth -= 5;

  if (data.orders.total > data.orders.previousMonth * 1.2) businessGrowth += 10;
  else if (data.orders.total < data.orders.previousMonth * 0.8) businessGrowth -= 10;

  businessGrowth = Math.max(0, Math.min(100, businessGrowth));

  // Overall Score (weighted average)
  const overallScore = Math.round(
    financialHealth * 0.3 +
    productionEfficiency * 0.2 +
    warehouseManagement * 0.15 +
    customerSatisfaction * 0.15 +
    businessGrowth * 0.2
  );

  return {
    financialHealth: Math.round(financialHealth),
    productionEfficiency: Math.round(productionEfficiency),
    warehouseManagement: Math.round(warehouseManagement),
    customerSatisfaction: Math.round(customerSatisfaction),
    businessGrowth: Math.round(businessGrowth),
    overallScore
  };
}

function generateInsights(data: ExecutiveData, scores: CompanyScores): Insight[] {
  const insights: Insight[] = [];

  // Revenue insights
  if (data.revenue.change > 15) {
    insights.push({
      type: 'positive',
      category: 'Przychody',
      title: 'Znaczny wzrost przychodów',
      description: `Przychód wzrósł o ${data.revenue.change.toFixed(1)}% w porównaniu do poprzedniego miesiąca. Głównym źródłem wzrostu są ${data.revenue.byType.orders3D > data.revenue.byType.storeOrders ? 'zamówienia 3D' : 'sprzedaż sklepowa'}.`,
      value: data.revenue.total,
      change: data.revenue.change
    });
  } else if (data.revenue.change < -10) {
    insights.push({
      type: 'critical',
      category: 'Przychody',
      title: 'Spadek przychodów',
      description: `Przychód spadł o ${Math.abs(data.revenue.change).toFixed(1)}% względem poprzedniego miesiąca. Wymaga natychmiastowej analizy przyczyn i działań naprawczych.`,
      value: data.revenue.total,
      change: data.revenue.change,
      recommendation: 'Przeanalizuj portfel klientów i intensyfikuj działania marketingowe.'
    });
  }

  // Profit margin insight
  if (data.profit.margin < 15) {
    insights.push({
      type: 'warning',
      category: 'Rentowność',
      title: 'Niska marża zysku',
      description: `Marża wynosi tylko ${data.profit.margin.toFixed(1)}%. Koszty materiałowe stanowią ${((data.expenses.breakdown.materials / (data.revenue.total || 1)) * 100).toFixed(0)}% przychodów.`,
      recommendation: 'Przeanalizuj ceny materiałów i rozważ korektę cennika usług.'
    });
  } else if (data.profit.margin > 30) {
    insights.push({
      type: 'positive',
      category: 'Rentowność',
      title: 'Excellentna marża zysku',
      description: `Marża wynosi ${data.profit.margin.toFixed(1)}% - firma generuje zdrowy zysk z każdej transakcji.`
    });
  }

  // Production efficiency insights
  if (data.production.utilization > 85) {
    insights.push({
      type: 'warning',
      category: 'Produkcja',
      title: 'Wysokie obciążenie produkcyjne',
      description: `Wykorzystanie maszyn wynosi ${data.production.utilization.toFixed(1)}%. Może to prowadzić do opóźnień w realizacji.`,
      recommendation: 'Rozważ rozszerzenie mocy produkcyjnych lub optymalizację harmonogramu.'
    });
  } else if (data.production.utilization < 40) {
    insights.push({
      type: 'info',
      category: 'Produkcja',
      title: 'Niskie wykorzystanie mocy produkcyjnych',
      description: `Maszyny wykorzystane w ${data.production.utilization.toFixed(1)}%. Jest rezerwa na przyjęcie większej liczby zamówień.`,
      recommendation: 'Intensyfikuj działania marketingowe aby zwiększyć obłożenie.'
    });
  }

  // Top material insight
  if (data.topMaterials.length > 0) {
    const topMaterial = data.topMaterials[0];
    insights.push({
      type: 'info',
      category: 'Produkty',
      title: 'Najbardziej dochodowy materiał',
      description: `${topMaterial.name} generuje ${topMaterial.revenue.toFixed(2)} PLN przychodu z ${topMaterial.sold} zamówień. Marża średnia: ${topMaterial.margin.toFixed(1)}%.`
    });
  }

  // Warehouse alerts
  if (data.warehouse.lowStock > 0) {
    const criticalItems = data.warehouse.lowStockItems.slice(0, 3);
    insights.push({
      type: 'critical',
      category: 'Magazyn',
      title: 'Niskie stany magazynowe',
      description: `${data.warehouse.lowStock} pozycji wymaga uzupełnienia: ${criticalItems.map(i => i.name).join(', ')}.`,
      recommendation: 'Natychmiast zleć dostawy dla brakujących materiałów.'
    });
  }

  // Filament low stock
  if (data.filaments.lowStock.length > 0) {
    insights.push({
      type: 'critical',
      category: 'Filamenty',
      title: 'Krytyczny stan filamentów',
      description: `${data.filaments.lowStock.length} filamentów jest poniżej minimalnego stanu: ${data.filaments.lowStock.slice(0, 3).map(f => `${f.material} ${f.color}`).join(', ')}.`,
      recommendation: 'Zamów filamenty w trybie ekspresowym.'
    });
  }

  // Customer insights
  if (data.customers.retentionRate > 40) {
    insights.push({
      type: 'positive',
      category: 'Klienci',
      title: 'Wysoka retencja klientów',
      description: `${data.customers.retentionRate.toFixed(1)}% klientów powraca z kolejnymi zamówieniami. Świadczy to o wysokiej jakości usług.`
    });
  }

  if (data.customers.new > 3) {
    insights.push({
      type: 'positive',
      category: 'Klienci',
      title: 'Nowi klienci',
      description: `Pozyskano ${data.customers.new} nowych klientów w tym miesiącu. Budowanie bazy klientów postępuje zgodnie z planem.`
    });
  }

  // Expense anomaly
  if (data.expenses.change > 20 && data.revenue.change < data.expenses.change) {
    insights.push({
      type: 'warning',
      category: 'Koszty',
      title: 'Nieproporcjonalny wzrost kosztów',
      description: `Koszty wzrosły o ${data.expenses.change.toFixed(1)}% podczas gdy przychody tylko o ${data.revenue.change.toFixed(1)}%.`,
      recommendation: 'Przeanalizuj pozycje kosztowe i zidentyfikuj obszary do optymalizacji.'
    });
  }

  return insights;
}

function generateRecommendations(data: ExecutiveData, scores: CompanyScores): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // High priority recommendations
  if (data.warehouse.lowStock > 0) {
    recommendations.push({
      priority: 'high',
      category: 'Magazyn',
      action: 'Uzupełnij stany magazynowe',
      expectedImpact: 'Uniknięcie opóźnień w realizacji zamówień',
      details: `Zamów: ${data.warehouse.lowStockItems.slice(0, 3).map(i => `${i.name} (brakuje ${i.minQuantity - i.quantity} szt.)`).join(', ')}`
    });
  }

  if (data.filaments.lowStock.length > 0) {
    const lowFilament = data.filaments.lowStock[0];
    recommendations.push({
      priority: 'high',
      category: 'Materiały',
      action: `Zamów filament ${lowFilament.material} ${lowFilament.color}`,
      expectedImpact: 'Ciągłość produkcji',
      details: `Pozostało ${lowFilament.remaining}g. Zalecane zamówienie: minimum 1kg.`
    });
  }

  if (data.profit.margin < 20) {
    recommendations.push({
      priority: 'high',
      category: 'Finanse',
      action: 'Zrewiduj cennik usług',
      expectedImpact: 'Zwiększenie marży o 5-10 punktów procentowych',
      details: 'Aktualna marża jest poniżej docelowej. Przeanalizuj koszty materiałowe i ceny konkurencji.'
    });
  }

  // Medium priority recommendations
  if (data.production.utilization < 50) {
    recommendations.push({
      priority: 'medium',
      category: 'Produkcja',
      action: 'Zwiększ działania marketingowe',
      expectedImpact: 'Wzrost obłożenia o 20-30%',
      details: `Obecne wykorzystanie: ${data.production.utilization.toFixed(1)}%. Jest rezerwa na więcej zamówień.`
    });
  }

  if (data.customers.retentionRate < 20) {
    recommendations.push({
      priority: 'medium',
      category: 'Klienci',
      action: 'Wdróż program lojalnościowy',
      expectedImpact: 'Wzrost retencji o 15-20%',
      details: 'Niska retencja sugeruje potrzebę budowania relacji z klientami.'
    });
  }

  if (data.production.queueSize > 10) {
    recommendations.push({
      priority: 'medium',
      category: 'Produkcja',
      action: 'Optymalizuj kolejkę produkcyjną',
      expectedImpact: 'Skrócenie czasu realizacji o 2-3 dni',
      details: `Aktualna kolejka: ${data.production.queueSize} zamówień waiting.`
    });
  }

  // Low priority / growth recommendations
  if (data.topMaterials.length > 0 && data.topMaterials[0].margin > 25) {
    recommendations.push({
      priority: 'low',
      category: 'Produkty',
      action: `Rozszerz ofertę ${data.topMaterials[0].name}`,
      expectedImpact: 'Potencjalny wzrost przychodów o 10-15%',
      details: `${data.topMaterials[0].name} ma wysoką marżę i popyt. Rozważ dodatkowe kolory/warianty.`
    });
  }

  recommendations.push({
    priority: 'low',
    category: 'Rozwój',
    action: 'Rozważ automatyzację wycen',
    expectedImpact: 'Oszczędność 2-3h tygodniowo',
    details: 'Wdrożenie automatycznego systemu wycen dla standardowych projektów.'
  });

  return recommendations;
}

function generateRisks(data: ExecutiveData, scores: CompanyScores): Risk[] {
  const risks: Risk[] = [];

  // Financial risks
  if (data.profit.gross < 0) {
    risks.push({
      level: 'critical',
      category: 'Finansowe',
      title: 'Strata operacyjna',
      description: `Firma odnotowała stratę ${Math.abs(data.profit.gross).toFixed(2)} PLN w tym miesiącu.`,
      probability: 100,
      impact: 'Wyczerpanie rezerw finansowych w ciągu 3-6 miesięcy bez działań naprawczych.',
      mitigation: 'Natychmiastowa redukcja kosztów i renegocjacja cen z dostawcami.'
    });
  } else if (data.profit.margin < 10) {
    risks.push({
      level: 'high',
      category: 'Finansowe',
      title: 'Niska rentowność',
      description: `Marża wynosi tylko ${data.profit.margin.toFixed(1)}%. Mały margines bezpieczeństwa.`,
      probability: 70,
      impact: 'Każdy nieoczekiwany koszt może doprowadzić do straty.',
      mitigation: 'Zwiększenie cen lub optymalizacja kosztów materiałowych.'
    });
  }

  // Supply chain risks
  if (data.filaments.lowStock.length > 2) {
    risks.push({
      level: 'high',
      category: 'Łańcuch dostaw',
      title: 'Braki materiałowe',
      description: `${data.filaments.lowStock.length} filamentów jest poniżej poziomu bezpiecznego.`,
      probability: 80,
      impact: 'Możliwe opóźnienia w realizacji zamówień i utrata klientów.',
      mitigation: 'Utrzymywanie wyższych stanów bezpiecznych i多元化 dostawców.'
    });
  }

  // Operational risks
  if (data.production.utilization > 90) {
    risks.push({
      level: 'medium',
      category: 'Operacyjne',
      title: 'Przeładowanie produkcyjne',
      description: 'Maszyny pracują na granicy wydajności.',
      probability: 60,
      impact: 'Zwiększone ryzyko awarii i opóźnień w realizacji.',
      mitigation: 'Planowane przerwy techniczne i monitoring stanu maszyn.'
    });
  }

  if (data.production.queueSize > 15) {
    risks.push({
      level: 'medium',
      category: 'Operacyjne',
      title: 'Długa kolejka produkcyjna',
      description: `${data.production.queueSize} zamówień czeka w kolejce.`,
      probability: 50,
      impact: 'Czas realizacji może przekroczyć oczekiwania klientów.',
      mitigation: 'Komunikacja z klientami i priorytetyzacja zamówień express.'
    });
  }

  // Market risks
  if (data.revenue.change < -15) {
    risks.push({
      level: 'high',
      category: 'Rynkowe',
      title: 'Trend spadkowy przychodów',
      description: 'Dwa kolejne miesiące ze spadkiem przychodów.',
      probability: 70,
      impact: 'Może sygnalizować utratę pozycji rynkowej lub sezonowość.',
      mitigation: 'Analiza konkurencji i wzmocnienie działań sprzedażowych.'
    });
  }

  // Always add at least one strategic risk
  risks.push({
    level: 'low',
    category: 'Strategiczne',
    title: 'Uzależnienie od kluczowych klientów',
    description: `Top 5 klientów generuje ${data.customers.top.length > 0 ? ((data.customers.top.reduce((s, c) => s + c.value, 0) / (data.revenue.total || 1)) * 100).toFixed(0) : 0}% przychodów.`,
    probability: 40,
    impact: 'Utrata kluczowego klienta znacząco wpłynie na przychody.',
    mitigation: 'Dywersyfikacja bazy klientów i budowanie relacji.'
  });

  return risks;
}

function generateForecast(data: ExecutiveData): Forecast {
  const avgRevenueGrowth = data.revenue.change;
  const avgOrderGrowth = data.orders.previousMonth > 0
    ? ((data.orders.total - data.orders.previousMonth) / data.orders.previousMonth) * 100
    : 10;

  let predictedRevenue = data.revenue.total * (1 + (avgRevenueGrowth / 100) * 0.7);
  let predictedProfit = predictedRevenue * (data.profit.margin / 100);
  let predictedOrders = Math.round(data.orders.total * (1 + (avgOrderGrowth / 100) * 0.5));

  // Apply some bounds
  predictedRevenue = Math.max(predictedRevenue, data.revenue.total * 0.8);
  predictedProfit = Math.max(predictedProfit, 0);
  predictedOrders = Math.max(predictedOrders, Math.round(data.orders.total * 0.9));

  const revenueConfidence = Math.max(50, Math.min(90, 70 + (data.revenue.change > 0 ? 10 : -10)));
  const profitConfidence = Math.max(40, Math.min(85, 65 + (data.profit.margin > 20 ? 10 : -10)));
  const ordersConfidence = Math.max(50, Math.min(85, 70));

  return {
    revenue: { value: Math.round(predictedRevenue), confidence: revenueConfidence },
    profit: { value: Math.round(predictedProfit), confidence: profitConfidence },
    orders: { value: predictedOrders, confidence: ordersConfidence },
    assumptions: [
      'Brak znaczących zmian w warunkach rynkowych',
      'Utrzymanie obecnej bazy klientów',
      'Stabilność cen materiałów',
      'Dostępność mocy produkcyjnych'
    ]
  };
}

function generateCEOComment(data: ExecutiveData, scores: CompanyScores, forecast: Forecast): string {
  const month = format(data.period.start, 'MMMM yyyy', { locale: pl });

  let comment = `RAPORT MENSUALNY - ${month}\n\n`;

  // Executive summary
  comment += `Ten miesiąc przyniósł ${data.revenue.change >= 0 ? 'wzrost' : 'spadek'} przychodów o ${Math.abs(data.revenue.change).toFixed(1)}% `;
  comment += `w porównaniu do poprzedniego okresu. `;

  if (data.profit.gross > 0) {
    comment += `Firma zaksięgowała zysk brutto w wysokości ${data.profit.gross.toFixed(2)} PLN `;
    comment += `przy marży ${data.profit.margin.toFixed(1)}%. `;
  } else {
    comment += `Firma odnotowała stratę operacyjną ${Math.abs(data.profit.gross).toFixed(2)} PLN. `;
  }

  // Production commentary
  if (data.production.utilization > 80) {
    comment += `Produkcja pracuje na wysokich obrotach z wykorzystaniem mocy ${data.production.utilization.toFixed(0)}%. `;
  } else if (data.production.utilization < 50) {
    comment += `Mamy rezerwę w mocy produkcyjnej (wykorzystanie ${data.production.utilization.toFixed(0)}%), co daje pole do wzrostu. `;
  }

  // Customer commentary
  if (data.customers.new > 3) {
    comment += `Zyskaliśmy ${data.customers.new} nowych klientów, co świadczy o skuteczności naszych działań rynkowych. `;
  }

  if (data.customers.retentionRate > 40) {
    comment += `Wysoka retencja klientów (${data.customers.retentionRate.toFixed(0)}%) potwierdza jakość naszych usług.\n\n`;
  }

  // Score commentary
  comment += `OCENA KSIĘGOWA\n`;
  comment += `Ogólny wynik firmy: ${scores.overallScore}/100 punktów.\n`;
  comment += `Zdrowie finansowe: ${scores.financialHealth}/100 | `;
  comment += `Efektywność produkcji: ${scores.productionEfficiency}/100\n`;
  comment += `Zarządzanie magazynem: ${scores.warehouseManagement}/100 | `;
  comment += `Satysfakcja klientów: ${scores.customerSatisfaction}/100 | `;
  comment += `Wzrost biznesowy: ${scores.businessGrowth}/100\n\n`;

  // Risks and actions
  if (data.warehouse.lowStock > 0 || data.filaments.lowStock.length > 0) {
    comment += `UWAGA: Wymagane natychmiastowe działania w obszarze zaopatrzenia. `;
    comment += `Stany magazynowe wymagają uzupełnienia.\n\n`;
  }

  // Outlook
  comment += `PROGNOZA\n`;
  comment += `Przewiduję przychody na poziomie ${forecast.revenue.value.toFixed(0)} PLN `;
  comment += `(pewność: ${forecast.revenue.confidence}%); `;
  comment += `zysk ${forecast.profit.value.toFixed(0)} PLN; `;
  comment += `${forecast.orders.value} zamówień.\n\n`;

  // Closing
  comment += `Zalecam:\n`;
  if (data.warehouse.lowStock > 0) {
    comment += `1. Niezwłoczne uzupełnienie stanów magazynowych\n`;
  }
  if (data.profit.margin < 20) {
    comment += `${data.warehouse.lowStock > 0 ? '2' : '1'}. Przegląd cennika w celu poprawy rentowności\n`;
  }
  comment += `Kontynuujemy budowanie wartości firmy. Klienci doceniają naszą jakość i terminowość.`;

  return comment;
}

function generateNotifications(data: ExecutiveData): Array<{ type: string; title: string; message: string; priority: string }> {
  const notifications: Array<{ type: string; title: string; message: string; priority: string }> = [];

  // Critical notifications
  if (data.warehouse.lowStock > 0) {
    notifications.push({
      type: 'critical',
      title: 'Niskie stany magazynowe',
      message: `${data.warehouse.lowStock} pozycji wymaga natychmiastowego uzupełnienia.`,
      priority: 'high'
    });
  }

  if (data.filaments.lowStock.length > 0) {
    notifications.push({
      type: 'critical',
      title: 'Krytyczny stan filamentów',
      message: `${data.filaments.lowStock.length} filamentów poniżej minimum. Ryzyko wstrzymania produkcji.`,
      priority: 'high'
    });
  }

  if (data.profit.gross < 0) {
    notifications.push({
      type: 'critical',
      title: 'Strata operacyjna',
      message: `Firma odnotowała stratę ${Math.abs(data.profit.gross).toFixed(2)} PLN. Wymagane działania naprawcze.`,
      priority: 'high'
    });
  }

  // Warning notifications
  if (data.revenue.change < -15) {
    notifications.push({
      type: 'warning',
      title: 'Znaczny spadek przychodów',
      message: `Przychody spadły o ${Math.abs(data.revenue.change).toFixed(1)}% względem poprzedniego miesiąca.`,
      priority: 'medium'
    });
  }

  if (data.production.utilization > 90) {
    notifications.push({
      type: 'warning',
      title: 'Przeładowanie produkcyjne',
      message: `Wykorzystanie maszyn wynosi ${data.production.utilization.toFixed(0)}%. Ryzyko awarii.`,
      priority: 'medium'
    });
  }

  if (data.profit.margin < 15 && data.profit.margin > 0) {
    notifications.push({
      type: 'warning',
      title: 'Niska marża',
      message: `Marża wynosi ${data.profit.margin.toFixed(1)}%. Mały margines bezpieczeństwa.`,
      priority: 'medium'
    });
  }

  // Info notifications
  if (data.customers.new > 5) {
    notifications.push({
      type: 'success',
      title: 'Nowi klienci',
      message: `Pozyskano ${data.customers.new} nowych klientów w tym miesiącu.`,
      priority: 'low'
    });
  }

  if (data.production.queueSize > 15) {
    notifications.push({
      type: 'warning',
      title: 'Długa kolejka produkcyjna',
      message: `${data.production.queueSize} zamówień czeka w kolejce. Przewidywane opóźnienia.`,
      priority: 'medium'
    });
  }

  return notifications;
}

function generateExecutiveAnalysis(data: ExecutiveData, scores: CompanyScores): string {
  return generateFallbackAnalysis(data, scores);
}

function generateFallbackAnalysis(data: ExecutiveData, scores: CompanyScores): string {
  const month = format(data.period.start, 'MMMM yyyy', { locale: pl });

  return `RAPORT WYKONAWCZY - ${month}

=== PODSUMOWANIE WYKONAWCZE ===
Przychody ${data.revenue.change >= 0 ? 'wzrosły' : 'spadły'} o ${Math.abs(data.revenue.change).toFixed(1)}% r/r do ${Math.round(data.revenue.total)} PLN.
Zysk brutto wyniósł ${Math.round(data.profit.gross)} PLN przy marży ${data.profit.margin.toFixed(1)}%.
Ogólny wynik firmy: ${scores.overallScore}/100 punktów.

=== ANALIZA PRZYCHODÓW ===
Główne źródło: ${data.revenue.byType.orders3D > data.revenue.byType.storeOrders ? 'zamówienia 3D' : 'sprzedaż sklepowa'}.
${data.revenue.change > 10 ? 'Wzrost wynika z zwiększonego popytu i skutecznych działań sprzedażowych.' : data.revenue.change < -10 ? 'Spadek wymaga analizy rynku i działań naprawczych.' : 'Wyniki stabilne.'}

=== ANALIZA KOSZTÓW I RENTOWNOŚCI ===
Koszty całkowite: ${Math.round(data.expenses.total)} PLN.
Materiały: ${Math.round(data.expenses.breakdown.materials)} PLN | Energia: ${Math.round(data.expenses.breakdown.electricity)} PLN.
${data.profit.margin < 20 ? 'MARŻA NISKA - rekomendowana korekta cenowa.' : 'Marża na akceptowalnym poziomie.'}

=== EFEKTYWNOŚĆ PRODUKCYJNA ===
Wykorzystanie mocy: ${data.production.utilization.toFixed(0)}% | Godziny pracy: ${Math.round(data.production.totalHours)} h.
${data.production.utilization > 80 ? 'Wyskie obciążenie - ryzyko opóźnień.' : 'Rezerwa mocy produkcyjnej dostępna.'}
Kolejka: ${data.production.queueSize} zamówień.

=== STAN MAGAZYNU I MATERIAŁÓW ===
Wartość magazynu: ${Math.round(data.warehouse.totalValue)} PLN.
${data.warehouse.lowStock > 0 ? `UWAGA: ${data.warehouse.lowStock} pozycji wymaga uzupełnienia.` : 'Stany w normie.'}
${data.filaments.lowStock.length > 0 ? `KRYTYCZNE: ${data.filaments.lowStock.length} filamentów poniżej minimum.` : 'Filamenty dostępne.'}

=== BAZA KLIENTÓW ===
Klienci: ${data.customers.total} | Nowi: ${data.customers.new} | Retencja: ${data.customers.retentionRate.toFixed(0)}%.
${data.customers.retentionRate > 40 ? 'Wysoka lojalność klientów.' : 'Potrzeba działań w obszarze retencji.'}

=== REKOMENDACJE NA NASTĘPNY MIESIĄC ===
${data.warehouse.lowStock > 0 ? '1. PRIORYTET: Uzupełnij braki magazynowe natychmiast.' : ''}
${data.profit.margin < 20 ? '2. Przeanalizuj cennik pod kątem rentowności.' : '2. Utrzymaj obecne poziomy cenowe.'}
${data.production.utilization < 60 ? '3. Zintensyfikuj działania marketingowe.' : '3. Monitoruj obciążenie produkcyjne.'}
4. Kontynuuj budowanie relacji z kluczowymi klientami.`;
}

export async function generateExecutiveReport(
  year: number,
  month: number
): Promise<{ id: string; summary: string; scores: CompanyScores }> {
  const supabase = getSupabaseAdmin();

  const periodStart = startOfMonth(new Date(year, month - 1));
  const periodEnd = endOfMonth(new Date(year, month - 1));

  // Check if report already exists
  const { data: existingReport } = await supabase
    .from('executive_reports')
    .select('*')
    .eq('report_month', periodStart.toISOString().split('T')[0])
    .maybeSingle();

  if (existingReport) {
    return {
      id: existingReport.id,
      summary: existingReport.summary,
      scores: existingReport.scores as CompanyScores
    };
  }

  // Fetch data
  const data = await fetchExecutiveData(periodStart, periodEnd);

  // Generate scores
  const scores = calculateScores(data);

  // Generate insights and recommendations
  const insights = generateInsights(data, scores);
  const recommendations = generateRecommendations(data, scores);
  const risks = generateRisks(data, scores);
  const forecast = generateForecast(data);
  const ceoComment = generateCEOComment(data, scores, forecast);
  const notifications = generateNotifications(data);

  // Generate executive analysis
  const executiveAnalysis = generateExecutiveAnalysis(data, scores);

  // Create report
  const { data: report, error: insertError } = await supabase
    .from('executive_reports')
    .insert({
      report_month: periodStart,
      report_year: year,
      title: `Raport Wykonawczy - ${format(periodStart, 'MMMM yyyy', { locale: pl })}`,
      summary: executiveAnalysis,
      full_report: {
        period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
        revenue: data.revenue,
        expenses: data.expenses,
        profit: data.profit,
        orders: data.orders,
        production: data.production,
        warehouse: data.warehouse,
        customers: data.customers
      },
      scores,
      recommendations,
      risks,
      forecast,
      insights,
      notifications,
      status: 'generated'
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Błąd zapisu raportu: ${insertError.message}`);
  }

  // Save scores history
  await supabase
    .from('ai_scores_history')
    .insert({
      report_id: report.id,
      report_month: periodStart,
      financial_health: scores.financialHealth,
      production_efficiency: scores.productionEfficiency,
      warehouse_management: scores.warehouseManagement,
      customer_satisfaction: scores.customerSatisfaction,
      business_growth: scores.businessGrowth,
      overall_score: scores.overallScore
    });

  // Save notifications
  for (const notification of notifications) {
    await supabase
      .from('ai_notifications')
      .insert({
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        report_id: report.id
      });
  }

  // Save trends
  await supabase
    .from('monthly_trends')
    .insert({
      report_month: periodStart,
      revenue: data.revenue.total,
      expenses: data.expenses.total,
      profit: data.profit.gross,
      orders: data.orders.total,
      customers_new: data.customers.new,
      production_hours: data.production.totalHours,
      utilization: data.production.utilization,
      margin: data.profit.margin
    });

  return {
    id: report.id,
    summary: executiveAnalysis,
    scores
  };
}

export { fetchExecutiveData, calculateScores, generateInsights, generateRecommendations, generateRisks, generateForecast };
export type { ExecutiveData, CompanyScores, Insight, Recommendation, Risk, Forecast, ExecutiveReport };
