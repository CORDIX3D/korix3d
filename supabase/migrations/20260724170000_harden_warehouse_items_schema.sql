-- Complete the legacy warehouse table used by dashboards and reports.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  barcode text,
  qr_code text,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 0,
  warehouse_location text,
  purchase_price numeric(12,2),
  selling_price numeric(12,2),
  weight_grams integer,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_items
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS qr_code text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warehouse_location text,
  ADD COLUMN IF NOT EXISTS purchase_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS selling_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.warehouse_items
SET
  sku = COALESCE(NULLIF(trim(sku), ''), 'MAG-' || upper(left(id::text, 8))),
  name = COALESCE(NULLIF(trim(name), ''), 'Pozycja magazynowa'),
  quantity = GREATEST(COALESCE(quantity, 0), 0),
  min_quantity = GREATEST(COALESCE(min_quantity, 0), 0),
  dimensions = COALESCE(dimensions, '{}'::jsonb),
  images = COALESCE(images, '[]'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.warehouse_items
  ALTER COLUMN sku SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN quantity SET DEFAULT 0,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN min_quantity SET DEFAULT 0,
  ALTER COLUMN min_quantity SET NOT NULL,
  ALTER COLUMN dimensions SET DEFAULT '{}'::jsonb,
  ALTER COLUMN dimensions SET NOT NULL,
  ALTER COLUMN images SET DEFAULT '[]'::jsonb,
  ALTER COLUMN images SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS warehouse_items_sku_idx ON public.warehouse_items (sku);
CREATE INDEX IF NOT EXISTS warehouse_items_quantity_idx ON public.warehouse_items (quantity, min_quantity);
CREATE INDEX IF NOT EXISTS warehouse_items_product_idx ON public.warehouse_items (product_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouse_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.warehouse_items
      ADD CONSTRAINT warehouse_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_warehouse_items_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS warehouse_items_set_updated_at ON public.warehouse_items;
CREATE TRIGGER warehouse_items_set_updated_at
  BEFORE UPDATE ON public.warehouse_items
  FOR EACH ROW EXECUTE FUNCTION public.set_warehouse_items_updated_at();

ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouse_items_employee_read ON public.warehouse_items;
DROP POLICY IF EXISTS warehouse_items_employee_write ON public.warehouse_items;

CREATE POLICY warehouse_items_employee_read ON public.warehouse_items
  FOR SELECT TO authenticated
  USING (public.is_employee());

CREATE POLICY warehouse_items_employee_write ON public.warehouse_items
  FOR ALL TO authenticated
  USING (public.is_employee())
  WITH CHECK (public.is_employee());
