export interface ExecutiveData {
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

export interface CompanyScores {
  financialHealth: number;
  productionEfficiency: number;
  warehouseManagement: number;
  customerSatisfaction: number;
  businessGrowth: number;
  overallScore: number;
}

export interface Insight {
  type: 'positive' | 'warning' | 'critical' | 'info';
  category: string;
  title: string;
  description: string;
  value?: number;
  change?: number;
  recommendation?: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  action: string;
  expectedImpact: string;
  details: string;
}

export interface Risk {
  level: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  probability: number;
  impact: string;
  mitigation: string;
}

export interface Forecast {
  revenue: { value: number; confidence: number };
  profit: { value: number; confidence: number };
  orders: { value: number; confidence: number };
  assumptions: string[];
}

export interface ExecutiveNotification {
  type: 'warning' | 'critical' | 'info' | 'success';
  category: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ExecutiveReport {
  summary: string;
  scores: CompanyScores;
  insights: Insight[];
  recommendations: Recommendation[];
  risks: Risk[];
  forecast: Forecast;
  ceoComment: string;
  notifications: ExecutiveNotification[];
}
