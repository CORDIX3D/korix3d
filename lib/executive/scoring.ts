import type { CompanyScores, ExecutiveData } from '@/lib/executive/types';

export function calculateScores(data: ExecutiveData): CompanyScores {
  let financialHealth = 50;
  if (data.profit.margin >= 30) financialHealth += 25;
  else if (data.profit.margin >= 20) financialHealth += 15;
  else if (data.profit.margin >= 10) financialHealth += 5;
  else if (data.profit.margin < 0) financialHealth -= 20;

  if (data.revenue.change > 20) financialHealth += 15;
  else if (data.revenue.change > 10) financialHealth += 10;
  else if (data.revenue.change > 0) financialHealth += 5;
  else if (data.revenue.change < -10) financialHealth -= 15;

  financialHealth += data.profit.gross > 0 ? 10 : -10;
  financialHealth = Math.max(0, Math.min(100, financialHealth));

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

  let warehouseManagement = 70;
  if (data.warehouse.lowStock === 0) warehouseManagement += 20;
  else if (data.warehouse.lowStock <= 3) warehouseManagement += 10;
  else if (data.warehouse.lowStock > 10) warehouseManagement -= 20;
  else if (data.warehouse.lowStock > 5) warehouseManagement -= 10;

  if (data.filaments.lowStock.length === 0) warehouseManagement += 10;
  else if (data.filaments.lowStock.length > 3) warehouseManagement -= 10;
  warehouseManagement = Math.max(0, Math.min(100, warehouseManagement));

  let customerSatisfaction = 60;
  if (data.customers.retentionRate >= 40) customerSatisfaction += 20;
  else if (data.customers.retentionRate >= 25) customerSatisfaction += 10;
  else if (data.customers.retentionRate < 10) customerSatisfaction -= 10;

  if (data.orders.completionRate >= 95) customerSatisfaction += 10;
  else if (data.orders.completionRate < 80) customerSatisfaction -= 10;
  if (data.customers.new > 0) customerSatisfaction += 10;
  customerSatisfaction = Math.max(0, Math.min(100, customerSatisfaction));

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

  const overallScore = Math.round(
    financialHealth * 0.3
      + productionEfficiency * 0.2
      + warehouseManagement * 0.15
      + customerSatisfaction * 0.15
      + businessGrowth * 0.2
  );

  return {
    financialHealth: Math.round(financialHealth),
    productionEfficiency: Math.round(productionEfficiency),
    warehouseManagement: Math.round(warehouseManagement),
    customerSatisfaction: Math.round(customerSatisfaction),
    businessGrowth: Math.round(businessGrowth),
    overallScore,
  };
}
