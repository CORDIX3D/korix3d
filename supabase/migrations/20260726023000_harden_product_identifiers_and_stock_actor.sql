-- Keep store URLs/SKUs unique under concurrent admin writes and preserve the
-- authenticated actor in stock movement history written through service_role.

UPDATE public.products
SET
  sku = trim(sku),
  slug = lower(trim(slug));

WITH duplicate_skus AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(trim(sku))
      ORDER BY created_at, id
    ) AS duplicate_number
  FROM public.products
)
UPDATE public.products AS product
SET sku = left(trim(product.sku), 42) || '-' || upper(product.id::text)
FROM duplicate_skus
WHERE duplicate_skus.id = product.id
  AND duplicate_skus.duplicate_number > 1;

WITH duplicate_slugs AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY slug
      ORDER BY created_at, id
    ) AS duplicate_number
  FROM public.products
)
UPDATE public.products AS product
SET slug = left(product.slug, 140) || '-' || product.id::text
FROM duplicate_slugs
WHERE duplicate_slugs.id = product.id
  AND duplicate_slugs.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_unique_idx
  ON public.products (lower(sku));

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique_idx
  ON public.products (lower(slug));

CREATE OR REPLACE FUNCTION public.capture_product_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid := auth.uid();
  request_headers jsonb;
  actor_header text;
BEGIN
  IF COALESCE(OLD.stock_quantity, 0) = COALESCE(NEW.stock_quantity, 0) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.stock_quantity, 0) < 0 THEN
    RAISE EXCEPTION 'stock quantity cannot be negative' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE product_id = NEW.id
      AND previous_quantity = COALESCE(OLD.stock_quantity, 0)
      AND new_quantity = COALESCE(NEW.stock_quantity, 0)
      AND order_id IS NOT NULL
      AND created_at > now() - interval '1 minute'
  ) THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL AND auth.role() = 'service_role' THEN
    BEGIN
      request_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
      actor_header := request_headers->>'x-korix-actor-id';

      IF actor_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        actor_id := actor_header::uuid;
      END IF;
    EXCEPTION
      WHEN invalid_text_representation OR invalid_parameter_value THEN
        actor_id := NULL;
    END;
  END IF;

  INSERT INTO public.stock_movements (
    product_id,
    previous_quantity,
    new_quantity,
    quantity_delta,
    operation_type,
    note,
    changed_by
  )
  VALUES (
    NEW.id,
    COALESCE(OLD.stock_quantity, 0),
    COALESCE(NEW.stock_quantity, 0),
    COALESCE(NEW.stock_quantity, 0) - COALESCE(OLD.stock_quantity, 0),
    'manual_adjustment',
    'Ręczna korekta stanu produktu',
    actor_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_product_stock_change() FROM PUBLIC;
