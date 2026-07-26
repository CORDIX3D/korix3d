import { z } from 'zod';

export function isValidPolishNip(value: string) {
  if (!/^\d{10}$/.test(value)) return false;

  const digits = value.split('').map(Number);
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const checksum = weights.reduce(
    (sum, weight, index) => sum + weight * digits[index],
    0
  ) % 11;

  return checksum !== 10 && checksum === digits[9];
}

const billingAddressSchema = z
  .object({
    invoiceType: z.enum(['individual', 'company']),
    name: z.string().trim().min(2).max(120),
    company: z.string().trim().max(160),
    nip: z.string().trim().max(10),
    street: z.string().trim().min(3).max(160),
    postalCode: z.string().trim().regex(/^\d{2}-\d{3}$/),
    city: z.string().trim().min(2).max(100),
    country: z.literal('PL'),
  })
  .superRefine((address, context) => {
    if (address.invoiceType !== 'company') return;

    if (address.company.length < 2) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['company'],
        message: 'Podaj nazwę firmy',
      });
    }

    if (!isValidPolishNip(address.nip)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nip'],
        message: 'Podaj prawidłowy 10-cyfrowy NIP',
      });
    }
  });

export const storeOrderItemsSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
    })
  )
  .min(1)
  .max(50)
  .superRefine((items, context) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Produkt występuje w koszyku więcej niż raz',
        });
      }
      ids.add(item.id);
    });
  });

export const storeOrderSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    phone: z.string().trim().min(7).max(30).regex(/^[+\d\s()-]+$/),
  }),
  shippingAddress: z.object({
    street: z.string().trim().min(3).max(160),
    postalCode: z.string().trim().regex(/^\d{2}-\d{3}$/),
    city: z.string().trim().min(2).max(100),
    country: z.literal('PL'),
  }),
  billingAddress: billingAddressSchema,
  deliveryType: z.string().trim().min(1).max(80),
  couponCode: z.string().trim().regex(/^[A-Za-z0-9_-]{2,40}$/).optional(),
  items: storeOrderItemsSchema,
});
