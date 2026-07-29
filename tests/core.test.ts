import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildProductSalesReport } from '../lib/accounting/product-ranking';
import { calculateDiscount, normalizeCouponCode } from '../lib/discount';
import { parseDeliveryOptions } from '../lib/shipping';
import { getStripeSessionBinding } from '../lib/stripe-session';
import {
  canManageStoreOrderStatus,
  canTransitionStoreOrderStatus,
} from '../lib/store-order-status';
import {
  createQuotePricingSnapshot,
  parseQuotePricingSettings,
} from '../lib/quote-pricing';
import {
  addCartItem,
  cartItemsEqual,
  getCartSummary,
  reconcileCartItems,
  sanitizeCart,
  updateCartItemQuantity,
} from '../lib/cart';
import {
  createCheckoutToken,
  verifyCheckoutToken,
} from '../lib/checkout-token';
import {
  canTransitionOrder3DStatus,
  getAllowedOrder3DStatuses,
} from '../lib/order-3d-status';
import { validateQuoteFiles } from '../lib/quote-files';
import { validateQuoteFileSignature } from '../lib/quote-file-content';
import { productPayloadSchema } from '../lib/product-validation';
import { PUBLIC_PRODUCT_COLUMNS } from '../lib/public-product';
import { PUBLIC_FILAMENT_COLUMNS } from '../lib/public-filament';
import { PUBLIC_MATERIAL_COLUMNS } from '../lib/public-material';
import { CUSTOMER_ORDER_3D_COLUMNS } from '../lib/customer-order';
import {
  publicSupabaseEnvironmentSchema,
  slicerServerEnvironmentSchema,
  stripeEnvironmentSchema,
  supabaseServiceEnvironmentSchema,
} from '../lib/env/schema';
import {
  isExpectedStripeAmount,
  isFullStripeRefund,
  shouldReleaseStockAfterStripeEvent,
} from '../lib/stripe-webhook';
import {
  isValidPolishNip,
  storeOrderSchema,
} from '../lib/store-order-validation';
import { createClient } from '../lib/supabase/client';
import type { Product } from '../lib/types/database';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Próbka',
    slug: 'probka',
    sku: 'TEST-1',
    short_description: null,
    description: null,
    price: 10,
    compare_price: null,
    cost_price: null,
    category_id: null,
    stock_quantity: 10,
    min_stock_quantity: 2,
    weight_grams: null,
    dimensions: null,
    images: [],
    active: true,
    featured: false,
    stripe_price_id: null,
    meta_title: null,
    meta_description: null,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    ...overrides,
  };
}

test('koszyk odrzuca uszkodzone dane, łączy duplikaty i respektuje stan', () => {
  const items = sanitizeCart([
    { id: 'a', name: 'A', price: 12.5, quantity: 7, stockQuantity: 8 },
    { id: 'a', name: 'A', price: 12.5, quantity: 7, stockQuantity: 8 },
    { id: 'b', name: 'B', price: -1, quantity: 1, stockQuantity: 2 },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 8);
  assert.equal(items[0].slug, 'a');
});

test('dodawanie i edycja koszyka nie przekraczają dostępnego stanu', () => {
  let items = addCartItem([], product(), 7);
  items = addCartItem(items, product({ price: 15 }), 7);

  assert.equal(items[0].quantity, 10);
  assert.equal(items[0].price, 15);

  items = updateCartItemQuantity(items, items[0].id, 50);
  assert.equal(items[0].quantity, 10);

  items = updateCartItemQuantity(items, items[0].id, 0);
  assert.deepEqual(items, []);
});

test('podsumowanie koszyka liczy sztuki i wartość', () => {
  const items = sanitizeCart([
    { id: 'a', name: 'A', price: 10, quantity: 2, stockQuantity: 5 },
    { id: 'b', name: 'B', price: 5.5, quantity: 3, stockQuantity: 5 },
  ]);

  assert.deepEqual(getCartSummary(items), { itemCount: 5, subtotal: 36.5 });
});

test('odświeżenie koszyka pobiera aktualną cenę i ogranicza ilość do magazynu', () => {
  const current = sanitizeCart([{
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'stary-slug',
    sku: 'OLD',
    name: 'Stara nazwa',
    price: 25,
    image: null,
    quantity: 5,
    stockQuantity: 10,
  }]);
  const refreshed = reconcileCartItems(current, [product({
    price: 30,
    stock_quantity: 2,
    sku: 'NEW',
    name: 'Nowa nazwa',
  })]);

  assert.equal(refreshed.length, 1);
  assert.equal(refreshed[0].price, 30);
  assert.equal(refreshed[0].quantity, 2);
  assert.equal(refreshed[0].stockQuantity, 2);
  assert.equal(cartItemsEqual(current, refreshed), false);
});

test('odświeżenie koszyka usuwa nieaktywne i niedostępne produkty', () => {
  const current = sanitizeCart([{
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Produkt',
    price: 25,
    quantity: 1,
    stockQuantity: 1,
  }]);
  assert.deepEqual(reconcileCartItems(current, []), []);
  assert.deepEqual(
    reconcileCartItems(current, [product({ active: false })]),
    []
  );
});

test('token płatności jest unikalny i nie akceptuje zmienionej wartości', () => {
  const first = createCheckoutToken();
  const second = createCheckoutToken();

  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(verifyCheckoutToken(first.token, first.hash), true);
  const changedLastCharacter = first.token.endsWith('0') ? '1' : '0';
  assert.equal(
    verifyCheckoutToken(`${first.token.slice(0, -1)}${changedLastCharacter}`, first.hash),
    false
  );
  assert.equal(verifyCheckoutToken(first.token, null), false);
});

test('status zlecenia nie może pominąć etapów ani wrócić po wysyłce', () => {
  assert.equal(canTransitionOrder3DStatus('new', 'quoted'), true);
  assert.equal(canTransitionOrder3DStatus('new', 'printing'), false);
  assert.equal(canTransitionOrder3DStatus('shipped', 'printing'), false);
  assert.deepEqual(getAllowedOrder3DStatuses('invalid'), []);
});

test('metadane poprawnego prywatnego pliku wyceny są akceptowane', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const orderId = '00000000-0000-4000-8000-000000000002';
  const result = validateQuoteFiles(
    [
      {
        name: 'model.stl',
        size: 1024,
        type: 'stl',
        bucket: 'quote-files',
        storage_path: `${userId}/${orderId}/1-model-00000000-0000-4000-8000-000000000003.stl`,
      },
    ],
    userId,
    orderId
  );

  assert.equal(result, null);
});

test('pliki wyceny odrzucają obcego właściciela, zły typ, duży plik i duplikat', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const orderId = '00000000-0000-4000-8000-000000000002';
  const path = `${userId}/${orderId}/model.stl`;
  const valid = {
    name: 'model.stl',
    size: 1024,
    type: 'stl',
    bucket: 'quote-files',
    storage_path: path,
  };

  assert.match(validateQuoteFiles([{ ...valid, storage_path: `other/${orderId}/model.stl` }], userId, orderId) || '', /metadane/);
  assert.match(validateQuoteFiles([{ ...valid, type: 'exe', storage_path: `${userId}/${orderId}/model.exe` }], userId, orderId) || '', /metadane/);
  assert.match(validateQuoteFiles([{ ...valid, size: 50 * 1024 * 1024 + 1 }], userId, orderId) || '', /metadane/);
  assert.match(validateQuoteFiles([valid, valid], userId, orderId) || '', /metadane/);
  assert.match(validateQuoteFiles([{ ...valid, name: '../model.stl' }], userId, orderId) || '', /metadane/);
  assert.match(validateQuoteFiles([{ ...valid, name: 'model.obj' }], userId, orderId) || '', /metadane/);
});

test('serwer rozpoznaje zawartość plików 3D zamiast ufać rozszerzeniu', () => {
  const step = new TextEncoder().encode('ISO-10303-21;\nHEADER;\nENDSEC;');
  const obj = new TextEncoder().encode('# model\nv 0 0 0\nf 1 2 3\n');
  const html = new TextEncoder().encode('<!doctype html><script>alert(1)</script>');
  const threeMfHead = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  const threeMfTail = new TextEncoder().encode('[Content_Types].xml 3D/3dmodel.model');
  const binaryStl = new Uint8Array(84);
  new DataView(binaryStl.buffer).setUint32(80, 0, true);

  assert.equal(validateQuoteFileSignature({ type: 'step', size: step.length }, step), null);
  assert.equal(validateQuoteFileSignature({ type: 'obj', size: obj.length }, obj), null);
  assert.equal(validateQuoteFileSignature({ type: 'stl', size: 84 }, binaryStl), null);
  assert.equal(
    validateQuoteFileSignature({ type: '3mf', size: 1024 }, threeMfHead, threeMfTail),
    null
  );
  assert.match(
    validateQuoteFileSignature({ type: 'stl', size: html.length }, html) || '',
    /niebezpieczną/
  );
  assert.match(
    validateQuoteFileSignature({ type: 'step', size: obj.length }, obj) || '',
    /STEP/
  );
});

const baseStoreOrder = {
  customer: {
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    phone: '+48 123 456 789',
  },
  shippingAddress: {
    street: 'Przykładowa 1',
    postalCode: '00-001',
    city: 'Warszawa',
    country: 'PL' as const,
  },
  billingAddress: {
    invoiceType: 'individual' as const,
    name: 'Jan Kowalski',
    company: '',
    nip: '',
    street: 'Przykładowa 1',
    postalCode: '00-001',
    city: 'Warszawa',
    country: 'PL' as const,
  },
  deliveryType: 'courier',
  items: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      quantity: 2,
    },
  ],
};

test('zamówienie osoby fizycznej wymaga adresu wysyłki i faktury', () => {
  assert.equal(storeOrderSchema.safeParse(baseStoreOrder).success, true);

  const missingShippingStreet = {
    ...baseStoreOrder,
    shippingAddress: { ...baseStoreOrder.shippingAddress, street: '' },
  };
  const missingBillingStreet = {
    ...baseStoreOrder,
    billingAddress: { ...baseStoreOrder.billingAddress, street: '' },
  };

  assert.equal(storeOrderSchema.safeParse(missingShippingStreet).success, false);
  assert.equal(storeOrderSchema.safeParse(missingBillingStreet).success, false);
});

test('faktura firmowa wymaga nazwy i NIP z prawidłową sumą kontrolną', () => {
  assert.equal(isValidPolishNip('1234563218'), true);
  assert.equal(isValidPolishNip('1234567890'), false);

  const companyOrder = {
    ...baseStoreOrder,
    billingAddress: {
      ...baseStoreOrder.billingAddress,
      invoiceType: 'company' as const,
      company: 'KORIX3D',
      nip: '1234563218',
    },
  };
  assert.equal(storeOrderSchema.safeParse(companyOrder).success, true);
  assert.equal(
    storeOrderSchema.safeParse({
      ...companyOrder,
      billingAddress: { ...companyOrder.billingAddress, nip: '1234567890' },
    }).success,
    false
  );
});

const baseProductPayload = {
  sku: 'KORIX-TEST-1',
  name: 'Produkt testowy',
  slug: 'produkt-testowy',
  short_description: 'Krótki opis',
  description: 'Opis produktu',
  category_id: null,
  price: 99.99,
  compare_price: 129.99,
  cost_price: 40,
  stock_quantity: 10,
  min_stock_quantity: 2,
  weight_grams: 250,
  images: ['https://example.com/product.webp'],
  active: true,
  featured: false,
};

test('produkt wymaga poprawnego SKU, ceny, slugu i stanu', () => {
  assert.equal(productPayloadSchema.safeParse(baseProductPayload).success, true);
  assert.equal(
    productPayloadSchema.safeParse({ ...baseProductPayload, sku: 'złe sku!' }).success,
    false
  );
  assert.equal(
    productPayloadSchema.safeParse({ ...baseProductPayload, stock_quantity: -1 }).success,
    false
  );
  assert.equal(
    productPayloadSchema.safeParse({ ...baseProductPayload, compare_price: 50 }).success,
    false
  );
});

test('edycja produktu wymaga wersji rekordu i ogranicza galerię do 8 zdjęć', () => {
  const editingProduct = {
    ...baseProductPayload,
    id: '00000000-0000-4000-8000-000000000001',
  };
  assert.equal(productPayloadSchema.safeParse(editingProduct).success, false);
  assert.equal(
    productPayloadSchema.safeParse({
      ...editingProduct,
      expected_updated_at: new Date().toISOString(),
    }).success,
    true
  );
  assert.equal(
    productPayloadSchema.safeParse({
      ...baseProductPayload,
      images: Array.from({ length: 9 }, (_, index) => `https://example.com/${index}.webp`),
    }).success,
    false
  );
});

test('brak konfiguracji Supabase zwraca błąd zamiast danych demonstracyjnych', async () => {
  const client = createClient();
  const queryResult = await client.from('products').select('*');
  const authResult = await client.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'dowolne-haslo',
  });

  assert.equal(queryResult.data, null);
  assert.equal(queryResult.error?.name, 'SupabaseUnavailableError');
  assert.equal(authResult.data?.session, null);
  assert.equal(authResult.error?.name, 'SupabaseUnavailableError');
});

test('ranking produktów obejmuje tylko poprawne pozycje i sumuje historię sprzedaży', () => {
  const report = buildProductSalesReport(
    [
      { product_id: 'a', sku: 'PLA-1', name: 'Filament PLA', quantity: 2, total: 80 },
      { product_id: 'a', sku: 'PLA-1', name: 'Filament PLA', quantity: 1, total: 40 },
      { product_id: 'b', sku: 'PETG-1', name: 'Filament PETG', quantity: 5, total: 100 },
      { product_id: 'c', sku: 'BAD', name: 'Błędna pozycja', quantity: 0, total: 500 },
      { product_id: null, sku: 'OLD-1', name: 'Produkt usunięty', quantity: 1, total: 10 },
    ],
    { a: 'Filamenty', b: 'Filamenty' }
  );

  assert.deepEqual(report.top, [
    { name: 'Filament PLA', sold: 3, revenue: 120 },
    { name: 'Filament PETG', sold: 5, revenue: 100 },
    { name: 'Produkt usunięty', sold: 1, revenue: 10 },
  ]);
  assert.deepEqual(report.byCategory, {
    Filamenty: 8,
    'Bez kategorii': 1,
  });
});

test('kupon procentowy i kwotowy liczą rabat od produktów z dokładnością do grosza', () => {
  assert.equal(normalizeCouponCode(' lato-10 '), 'LATO-10');
  assert.deepEqual(
    calculateDiscount(
      {
        code: 'LATO-10',
        discount_type: 'percent',
        discount_value: 10,
        active: true,
      },
      99.99
    ),
    { valid: true, code: 'LATO-10', amount: 10, subtotalAfterDiscount: 89.99 }
  );
  assert.deepEqual(
    calculateDiscount(
      {
        code: 'BON-150',
        discount_type: 'fixed',
        discount_value: 150,
        active: true,
      },
      100
    ),
    { valid: true, code: 'BON-150', amount: 100, subtotalAfterDiscount: 0 }
  );
});

test('kupon odrzuca wygaśnięcie, limit użyć i za mały koszyk', () => {
  const baseCoupon = {
    code: 'TEST-10',
    discount_type: 'percent',
    discount_value: 10,
    active: true,
  };
  assert.deepEqual(
    calculateDiscount({ ...baseCoupon, expires_at: '2020-01-01T00:00:00Z' }, 100),
    { valid: false, reason: 'expired' }
  );
  assert.deepEqual(
    calculateDiscount({ ...baseCoupon, max_uses: 2, used_count: 2 }, 100),
    { valid: false, reason: 'limit' }
  );
  assert.deepEqual(
    calculateDiscount({ ...baseCoupon, min_order_value: 200 }, 100),
    { valid: false, reason: 'minimum' }
  );
});

test('zamówienie przyjmuje poprawny kupon i odrzuca powtórzony produkt', () => {
  assert.equal(
    storeOrderSchema.safeParse({ ...baseStoreOrder, couponCode: 'LATO-10' }).success,
    true
  );
  assert.equal(
    storeOrderSchema.safeParse({ ...baseStoreOrder, couponCode: 'zły kod' }).success,
    false
  );
  assert.equal(
    storeOrderSchema.safeParse({
      ...baseStoreOrder,
      items: [baseStoreOrder.items[0], baseStoreOrder.items[0]],
    }).success,
    false
  );
});

test('metody dostawy pochodzą wyłącznie z poprawnej konfiguracji administratora', () => {
  assert.deepEqual(
    parseDeliveryOptions([
      { key: 'free_shipping_threshold', label: 'Próg', value: '200' },
      { key: 'courier_price', label: 'Kurier', value: '18,99' },
      { key: 'pickup_price', label: 'Odbiór osobisty', value: 0 },
      { key: 'broken_price', label: 'Błędna', value: 'brak' },
      { key: 'empty_price', label: 'Błędna', value: null },
      { key: 'negative_price', label: 'Błędna', value: -1 },
      { key: 'courier', label: 'Duplikat', value: 1 },
    ]),
    [
      { value: 'courier', label: 'Kurier', price: 18.99 },
      { value: 'pickup', label: 'Odbiór osobisty', price: 0 },
    ]
  );
  assert.deepEqual(parseDeliveryOptions([]), []);
});

test('kalkulator wymaga kompletnego i poprawnego cennika administratora', () => {
  const rows = [
    ['printing_hour_cost', '50'],
    ['electricity_hour_cost', '2,50'],
    ['maintenance_hour_cost', '5'],
    ['packaging_cost', '5'],
    ['default_margin', '25'],
    ['vat_rate', '23'],
    ['minimum_order_value', '20'],
    ['express_surcharge', '65'],
    ['urgent_surcharge', '120'],
  ].map(([key, value]) => ({ key, value }));

  assert.deepEqual(parseQuotePricingSettings(rows), {
    printing_hour_cost: 50,
    electricity_hour_cost: 2.5,
    maintenance_hour_cost: 5,
    packaging_cost: 5,
    default_margin: 25,
    vat_rate: 23,
    minimum_order_value: 20,
    express_surcharge: 65,
    urgent_surcharge: 120,
  });
  assert.equal(parseQuotePricingSettings(rows.slice(1)), null);
  assert.equal(
    parseQuotePricingSettings(rows.map((row) => row.key === 'vat_rate' ? { ...row, value: '101' } : row)),
    null
  );
});

test('wycena zapisuje niezmienną migawkę stawek i kosztu dostawy', () => {
  const settings = parseQuotePricingSettings([
    ['printing_hour_cost', '50'],
    ['electricity_hour_cost', '2.5'],
    ['maintenance_hour_cost', '5'],
    ['packaging_cost', '5'],
    ['default_margin', '25'],
    ['vat_rate', '23'],
    ['minimum_order_value', '20'],
    ['express_surcharge', '65'],
    ['urgent_surcharge', '120'],
  ].map(([key, value]) => ({ key, value })));

  assert.ok(settings);
  assert.deepEqual(createQuotePricingSnapshot(settings, {
    materialPricePerKg: 82.129,
    deliveryCost: 18.999,
    priority: 'express',
    capturedAt: '2026-07-26T10:00:00.000Z',
  }), {
    ...settings,
    material_price_per_kg: 82.13,
    delivery_cost: 19,
    priority: 'express',
    captured_at: '2026-07-26T10:00:00.000Z',
  });
  assert.equal(createQuotePricingSnapshot(settings, {
    materialPricePerKg: 0,
    deliveryCost: 18.99,
    priority: 'standard',
  }), null);
  assert.equal(createQuotePricingSnapshot(settings, {
    materialPricePerKg: 80,
    deliveryCost: 18.99,
    priority: 'overnight',
  }), null);
});

test('webhook Stripe rozróżnia brak, zgodność i konflikt sesji płatności', () => {
  assert.equal(getStripeSessionBinding(null, 'cs_test_new'), 'unbound');
  assert.equal(getStripeSessionBinding('', 'cs_test_new'), 'unbound');
  assert.equal(getStripeSessionBinding('cs_test_same', 'cs_test_same'), 'match');
  assert.equal(getStripeSessionBinding('cs_test_old', 'cs_test_new'), 'mismatch');
});

test('status zamówienia sklepu nie omija płatności ani etapów realizacji', () => {
  assert.equal(canTransitionStoreOrderStatus('pending', 'paid'), true);
  assert.equal(canTransitionStoreOrderStatus('pending', 'processing'), false);
  assert.equal(canTransitionStoreOrderStatus('paid', 'processing'), true);
  assert.equal(canTransitionStoreOrderStatus('processing', 'shipped'), true);
  assert.equal(canTransitionStoreOrderStatus('shipped', 'delivered'), true);
  assert.equal(canTransitionStoreOrderStatus('delivered', 'processing'), false);
  assert.equal(canTransitionStoreOrderStatus('cancelled', 'paid'), false);
  assert.equal(canTransitionStoreOrderStatus('paid', 'refunded'), true);
  assert.equal(canManageStoreOrderStatus('pending', 'paid'), false);
  assert.equal(canManageStoreOrderStatus('paid', 'processing'), true);
});

test('publiczny katalog nie udostępnia wewnętrznych pól produktu', () => {
  const publicColumns = new Set<string>(PUBLIC_PRODUCT_COLUMNS);
  assert.equal(publicColumns.has('cost_price'), false);
  assert.equal(publicColumns.has('min_stock_quantity'), false);
  assert.equal(publicColumns.has('stripe_price_id'), false);
  assert.equal(publicColumns.has('price'), true);
  assert.equal(publicColumns.has('stock_quantity'), true);
  assert.equal(publicColumns.has('images'), true);
});

test('publiczna lista filamentów nie ujawnia stanów ani kosztów magazynowych', () => {
  const publicColumns = new Set(PUBLIC_FILAMENT_COLUMNS.split(',').map((column) => column.trim()));
  assert.equal(publicColumns.has('price_per_kg'), false);
  assert.equal(publicColumns.has('price_paid'), false);
  assert.equal(publicColumns.has('remaining_weight_grams'), false);
  assert.equal(publicColumns.has('min_weight_grams'), false);
  assert.equal(publicColumns.has('location'), false);
  assert.equal(publicColumns.has('color'), true);
  assert.equal(publicColumns.has('brand'), true);
});

test('publiczna lista materiałów nie pobiera ceny używanej do wyceny', () => {
  const publicColumns = new Set(PUBLIC_MATERIAL_COLUMNS.split(',').map((column) => column.trim()));
  assert.equal(publicColumns.has('price_per_kg'), false);
  assert.equal(publicColumns.has('properties'), false);
  assert.equal(publicColumns.has('name'), true);
  assert.equal(publicColumns.has('description'), true);
});

test('panel klienta nie pobiera wewnętrznych składowych wyceny', () => {
  const customerColumns = new Set(CUSTOMER_ORDER_3D_COLUMNS.split(',').map((column) => column.trim()));
  for (const hiddenColumn of [
    'pricing_settings_snapshot',
    'slicing_result',
    'material_cost',
    'electricity_cost',
    'printing_cost',
    'packaging_cost',
    'margin_amount',
    'vat_amount',
    'admin_notes',
  ]) {
    assert.equal(customerColumns.has(hiddenColumn), false);
  }
  assert.equal(customerColumns.has('printing_time_hours'), true);
  assert.equal(customerColumns.has('filament_used_grams'), true);
  assert.equal(customerColumns.has('final_price'), true);
});

test('walidacja środowiska rozróżnia publiczne i serwerowe klucze Supabase', () => {
  const publicEnvironment = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: `sb_publishable_${'a'.repeat(32)}`,
  };
  assert.equal(publicSupabaseEnvironmentSchema.safeParse(publicEnvironment).success, true);
  assert.equal(supabaseServiceEnvironmentSchema.safeParse({
    ...publicEnvironment,
    SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${'b'.repeat(40)}`,
  }).success, true);
  assert.equal(supabaseServiceEnvironmentSchema.safeParse({
    ...publicEnvironment,
    SUPABASE_SERVICE_ROLE_KEY: `sbp_${'c'.repeat(40)}`,
  }).success, false);
});

test('walidacja Stripe odrzuca klucz ograniczony zamiast sekretu serwerowego', () => {
  const base = {
    STRIPE_WEBHOOK_SECRET: `whsec_${'a'.repeat(32)}`,
    NEXT_PUBLIC_SITE_URL: 'https://korix3d.pl',
  };
  assert.equal(stripeEnvironmentSchema.safeParse({
    ...base,
    STRIPE_SECRET_KEY: `sk_test_${'b'.repeat(32)}`,
  }).success, true);
  assert.equal(stripeEnvironmentSchema.safeParse({
    ...base,
    STRIPE_SECRET_KEY: `rk_test_${'b'.repeat(32)}`,
  }).success, false);
});

test('token zdalnego slicera musi być odpowiednio długi i bez spacji', () => {
  assert.equal(slicerServerEnvironmentSchema.safeParse({
    CREALITY_SLICER_WORKER_TOKEN: 'a'.repeat(32),
  }).success, true);
  assert.equal(slicerServerEnvironmentSchema.safeParse({
    CREALITY_SLICER_WORKER_TOKEN: 'za krótki token',
  }).success, false);
});

test('Stripe akceptuje wyłącznie dokładną kwotę zamówienia w PLN', () => {
  assert.equal(isExpectedStripeAmount('pln', 12345, 123.45), true);
  assert.equal(isExpectedStripeAmount('eur', 12345, 123.45), false);
  assert.equal(isExpectedStripeAmount('pln', 12344, 123.45), false);
  assert.equal(isExpectedStripeAmount('pln', null, 123.45), false);
});

test('częściowy zwrot Stripe nie zamyka całego zamówienia', () => {
  assert.equal(isFullStripeRefund({ refunded: true, amount: 10000, amountRefunded: 10000 }), true);
  assert.equal(isFullStripeRefund({ refunded: false, amount: 10000, amountRefunded: 5000 }), false);
  assert.equal(isFullStripeRefund({ refunded: true, amount: 10000, amountRefunded: 5000 }), false);
});

test('stan magazynowy jest zwalniany dopiero po definitywnym końcu Checkout', () => {
  assert.equal(shouldReleaseStockAfterStripeEvent('checkout.session.expired'), true);
  assert.equal(shouldReleaseStockAfterStripeEvent('checkout.session.async_payment_failed'), true);
  assert.equal(shouldReleaseStockAfterStripeEvent('payment_intent.payment_failed'), false);
  assert.equal(shouldReleaseStockAfterStripeEvent('checkout.session.completed'), false);
});
