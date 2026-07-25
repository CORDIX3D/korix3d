import type { Product } from '@/lib/types/database';

export const MAX_CART_QUANTITY = 99;

export interface CartItem {
  id: string;
  slug: string;
  sku: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stockQuantity: number;
}

export function sanitizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];

  const itemsById = new Map<string, CartItem>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;

    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') continue;

    const price = Number(candidate.price);
    const stockQuantity = Math.floor(Number(candidate.stockQuantity));
    const quantity = Math.floor(Number(candidate.quantity));
    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isFinite(stockQuantity) ||
      stockQuantity < 1 ||
      !Number.isFinite(quantity) ||
      quantity < 1
    ) {
      continue;
    }

    const safeStock = Math.min(stockQuantity, MAX_CART_QUANTITY);
    const existing = itemsById.get(candidate.id);
    const safeQuantity = Math.min(
      (existing?.quantity || 0) + quantity,
      safeStock,
      MAX_CART_QUANTITY
    );

    itemsById.set(candidate.id, {
      id: candidate.id,
      slug:
        typeof candidate.slug === 'string' && candidate.slug.trim()
          ? candidate.slug
          : candidate.id,
      sku: typeof candidate.sku === 'string' ? candidate.sku : '',
      name: candidate.name,
      price,
      image:
        typeof candidate.image === 'string' && candidate.image
          ? candidate.image
          : null,
      quantity: safeQuantity,
      stockQuantity: safeStock,
    });
  }

  return Array.from(itemsById.values());
}

export function addCartItem(
  current: CartItem[],
  product: Product,
  quantity = 1
): CartItem[] {
  const stockQuantity = Math.min(
    Math.floor(Number(product.stock_quantity)),
    MAX_CART_QUANTITY
  );
  const price = Number(product.price);
  if (
    !Number.isFinite(stockQuantity) ||
    stockQuantity <= 0 ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return current;
  }

  const safeQuantity = Math.min(
    Math.max(1, Math.floor(Number(quantity) || 1)),
    stockQuantity
  );
  const images = Array.isArray(product.images) ? (product.images as string[]) : [];
  const existing = current.find((item) => item.id === product.id);

  if (!existing) {
    return [
      ...current,
      {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        price,
        image: images[0] || null,
        quantity: safeQuantity,
        stockQuantity,
      },
    ];
  }

  return current.map((item) =>
    item.id === product.id
      ? {
          ...item,
          slug: product.slug,
          sku: product.sku,
          name: product.name,
          price,
          image: images[0] || null,
          quantity: Math.min(item.quantity + safeQuantity, stockQuantity),
          stockQuantity,
        }
      : item
  );
}

export function removeCartItem(current: CartItem[], productId: string) {
  return current.filter((item) => item.id !== productId);
}

export function updateCartItemQuantity(
  current: CartItem[],
  productId: string,
  quantity: number
) {
  return current
    .map((item) =>
      item.id === productId
        ? {
            ...item,
            quantity: Math.min(
              Math.max(0, Math.floor(Number(quantity) || 0)),
              item.stockQuantity,
              MAX_CART_QUANTITY
            ),
          }
        : item
    )
    .filter((item) => item.quantity > 0);
}

export function getCartSummary(items: CartItem[]) {
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };
}
