import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCartItem,
  getCartSummary,
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
import { productPayloadSchema } from '../lib/product-validation';
import {
  isValidPolishNip,
  storeOrderSchema,
} from '../lib/store-order-validation';
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
