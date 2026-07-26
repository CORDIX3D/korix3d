import { z } from 'zod';

const optionalMoney = z.number().finite().min(0).max(10_000_000).nullable();

export const productPayloadSchema = z
  .object({
    id: z.string().uuid().optional(),
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
    sku: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9._-]*$/i),
    name: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    short_description: z.string().trim().max(500).nullable(),
    description: z.string().trim().max(20_000).nullable(),
    category_id: z.string().uuid().nullable(),
    price: z.number().finite().positive().max(10_000_000),
    compare_price: optionalMoney,
    cost_price: optionalMoney,
    stock_quantity: z.number().int().min(0).max(1_000_000),
    min_stock_quantity: z.number().int().min(0).max(1_000_000),
    weight_grams: z.number().int().min(0).max(10_000_000).nullable(),
    images: z.array(z.string().url().max(2048)).max(8),
    active: z.boolean(),
    featured: z.boolean(),
  })
  .superRefine((product, context) => {
    if (
      product.compare_price !== null &&
      product.compare_price <= product.price
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['compare_price'],
        message: 'Cena przekreślona musi być większa od ceny sprzedaży',
      });
    }

    if (product.id && !product.expected_updated_at) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expected_updated_at'],
        message: 'Brak wersji edytowanego produktu',
      });
    }
  });

export type ProductPayload = z.infer<typeof productPayloadSchema>;
