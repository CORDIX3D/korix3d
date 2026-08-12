-- Older installations created product_name/price as required snapshot columns.
-- The current checkout writes their canonical replacements name/unit_price.
-- Keep the legacy columns for compatibility, but do not let them reject new rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_order_items'
      AND column_name = 'product_name'
  ) THEN
    ALTER TABLE public.store_order_items
      ALTER COLUMN product_name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_order_items'
      AND column_name = 'price'
  ) THEN
    ALTER TABLE public.store_order_items
      ALTER COLUMN price DROP NOT NULL;
  END IF;
END $$;
