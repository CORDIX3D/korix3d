import assert from 'node:assert/strict';
import { test } from 'vitest';
import { calculateScores } from '../lib/executive/scoring';
import type { ExecutiveData } from '../lib/executive/types';

function executiveData(overrides: Partial<ExecutiveData> = {}): ExecutiveData {
  return {
    period: { start: new Date('2026-07-01'), end: new Date('2026-07-31') },
    revenue: {
      total: 20_000,
      previousMonth: 16_000,
      change: 25,
      byType: { orders3D: 12_000, storeOrders: 8_000 },
      byMonth: [],
    },
    expenses: {
      total: 12_000,
      previousMonth: 11_000,
      change: 9,
      breakdown: { materials: 5_000, electricity: 1_000, maintenance: 1_000, shipping: 2_000, other: 3_000 },
    },
    profit: { gross: 8_000, previousMonth: 5_000, margin: 40, previousMargin: 31.25 },
    orders: {
      total: 30,
      previousMonth: 20,
      averageValue: 666.67,
      byPriority: { standard: 20, express: 8, urgent: 2 },
      completionRate: 98,
    },
    production: { totalHours: 300, utilization: 82, queueSize: 4, avgPrintTime: 10 },
    warehouse: { totalValue: 15_000, items: 80, lowStock: 0, lowStockItems: [] },
    filaments: { totalUsed: 12_000, byMaterial: {}, byColor: [], lowStock: [] },
    customers: { total: 25, new: 7, returning: 10, top: [], retentionRate: 45 },
    topProducts: [],
    topMaterials: [],
    ...overrides,
  };
}

test('scoring zarządczy nagradza rentowny wzrost i sprawną realizację', () => {
  assert.deepEqual(calculateScores(executiveData()), {
    financialHealth: 100,
    productionEfficiency: 100,
    warehouseManagement: 100,
    customerSatisfaction: 100,
    businessGrowth: 90,
    overallScore: 98,
  });
});

test('scoring obniża wynik przy stracie, spadku i problemach operacyjnych', () => {
  const data = executiveData({
    revenue: { ...executiveData().revenue, change: -25 },
    profit: { ...executiveData().profit, gross: -2_000, margin: -10 },
    orders: { ...executiveData().orders, total: 5, previousMonth: 20, completionRate: 50 },
    production: { ...executiveData().production, utilization: 20, queueSize: 30 },
    warehouse: { ...executiveData().warehouse, lowStock: 15 },
    filaments: {
      ...executiveData().filaments,
      lowStock: [
        { material: 'PLA', color: 'Czarny', remaining: 20 },
        { material: 'PETG', color: 'Biały', remaining: 20 },
        { material: 'ABS', color: 'Szary', remaining: 20 },
        { material: 'ASA', color: 'Niebieski', remaining: 20 },
      ],
    },
    customers: { ...executiveData().customers, new: 0, retentionRate: 5 },
  });
  const scores = calculateScores(data);

  assert.ok(scores.overallScore < 50);
  assert.ok(scores.financialHealth < 50);
  assert.ok(scores.productionEfficiency < 50);
  assert.ok(scores.warehouseManagement < 70);
});

test('każdy wynik zarządczy pozostaje w zakresie 0-100', () => {
  const scores = calculateScores(executiveData());
  Object.values(scores).forEach((score) => {
    assert.ok(Number.isInteger(score));
    assert.ok(score >= 0 && score <= 100);
  });
});
