export const emptyProductForm = {
  sku: '',
  name: '',
  slug: '',
  short_description: '',
  description: '',
  category_id: '',
  price: '',
  compare_price: '',
  cost_price: '',
  stock_quantity: '0',
  min_stock_quantity: '0',
  weight_grams: '',
  active: true,
  featured: false,
};

export type ProductForm = typeof emptyProductForm;

export const ALLOWED_PRODUCT_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export const MAX_PRODUCT_IMAGES = 8;

export function createProductSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseProductDecimal(value: string) {
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : Number.NaN;
}
