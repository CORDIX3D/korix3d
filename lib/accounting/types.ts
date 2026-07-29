export interface ReportData {
  period: { start: Date; end: Date };
  company: { name: string; address: string; nip: string; email: string; phone: string };
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
  profit: { gross: number; net: number; margin: number };
  vat: { input: number; output: number; due: number };
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
  forecast: { nextMonthRevenue: number; nextMonthOrders: number; confidence: string };
}
