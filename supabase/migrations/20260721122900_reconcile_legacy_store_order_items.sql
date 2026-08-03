-- Reconcile the legacy store order item schema before checkout functions are
-- installed. Older production databases used product_name/price, while the
-- current application stores immutable order snapshots in name/unit_price.

ALTER TABLE public.store_order_items
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_order_items'
      AND column_name = 'product_name'
  ) THEN
    UPDATE public.store_order_items
    SET name = product_name
    WHERE name IS NULL OR btrim(name) = '';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_order_items'
      AND column_name = 'price'
  ) THEN
    UPDATE public.store_order_items
    SET unit_price = round(GREATEST(COALESCE(price, 0), 0)::numeric, 2)
    WHERE unit_price IS NULL;
  END IF;
END $$;

UPDATE public.store_order_items
SET name = COALESCE(NULLIF(btrim(name), ''), NULLIF(btrim(sku), ''), 'Produkt')
WHERE name IS NULL OR btrim(name) = '';

UPDATE public.store_order_items
SET unit_price = round(
  GREATEST(
    COALESCE(
      unit_price,
      CASE WHEN quantity > 0 THEN total / quantity ELSE 0 END,
      0
    ),
    0
  )::numeric,
  2
)
WHERE unit_price IS NULL OR unit_price < 0 OR unit_price = 'NaN'::numeric;

ALTER TABLE public.store_order_items
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN unit_price SET NOT NULL;

ALTER TABLE public.store_order_items
  DROP CONSTRAINT IF EXISTS store_order_items_unit_price_check;
ALTER TABLE public.store_order_items
  ADD CONSTRAINT store_order_items_unit_price_check
  CHECK (unit_price >= 0 AND unit_price <> 'NaN'::numeric) NOT VALID;
