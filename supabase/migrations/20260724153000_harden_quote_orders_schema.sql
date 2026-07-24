-- Complete the 3D quote/order table used by customer uploads and production.
-- Existing rows are retained and missing values are normalized.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_quote_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT
    'WYC-' ||
    to_char(now(), 'YYYYMMDD') ||
    '-' ||
    upper(left(replace(gen_random_uuid()::text, '-', ''), 6));
$$;

CREATE TABLE IF NOT EXISTS public.orders_3d (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT public.generate_quote_order_number(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name text,
  color text,
  color_hex text,
  layer_height numeric(6,3),
  quantity integer NOT NULL DEFAULT 1,
  priority text NOT NULL DEFAULT 'standard',
  notes text,
  status text NOT NULL DEFAULT 'new',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  printing_time_hours numeric(12,2),
  filament_used_grams numeric(12,2),
  material_cost numeric(12,2),
  electricity_cost numeric(12,2),
  printing_cost numeric(12,2),
  packaging_cost numeric(12,2),
  margin_amount numeric(12,2),
  vat_amount numeric(12,2),
  final_price numeric(12,2),
  tracking_number text,
  shipped_at timestamptz,
  assigned_to uuid,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS order_number text DEFAULT public.generate_quote_order_number(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS material_id uuid,
  ADD COLUMN IF NOT EXISTS material_name text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS color_hex text,
  ADD COLUMN IF NOT EXISTS layer_height numeric(6,3),
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS printing_time_hours numeric(12,2),
  ADD COLUMN IF NOT EXISTS filament_used_grams numeric(12,2),
  ADD COLUMN IF NOT EXISTS material_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS electricity_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS printing_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS packaging_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS margin_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS vat_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS final_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.orders_3d
SET
  order_number = COALESCE(NULLIF(trim(order_number), ''), public.generate_quote_order_number()),
  quantity = GREATEST(COALESCE(quantity, 1), 1),
  priority = CASE
    WHEN priority IN ('standard', 'express', 'urgent') THEN priority
    ELSE 'standard'
  END,
  status = CASE
    WHEN status IN (
      'new', 'quoted', 'accepted', 'queued', 'printing',
      'post_processing', 'packed', 'shipped', 'completed', 'cancelled'
    ) THEN status
    ELSE 'new'
  END,
  files = COALESCE(files, '[]'::jsonb),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.orders_3d
  ALTER COLUMN order_number SET DEFAULT public.generate_quote_order_number(),
  ALTER COLUMN order_number SET NOT NULL,
  ALTER COLUMN quantity SET DEFAULT 1,
  ALTER COLUMN quantity SET NOT NULL,
  ALTER COLUMN priority SET DEFAULT 'standard',
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'new',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN files SET DEFAULT '[]'::jsonb,
  ALTER COLUMN files SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS orders_3d_number_idx
  ON public.orders_3d (order_number);
CREATE INDEX IF NOT EXISTS orders_3d_user_created_idx
  ON public.orders_3d (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_3d_status_created_idx
  ON public.orders_3d (status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_user_id_fkey'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_material_id_fkey'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_material_id_fkey
      FOREIGN KEY (material_id) REFERENCES public.materials(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_orders_3d_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_3d_set_updated_at ON public.orders_3d;
CREATE TRIGGER orders_3d_set_updated_at
  BEFORE UPDATE ON public.orders_3d
  FOR EACH ROW EXECUTE FUNCTION public.set_orders_3d_updated_at();

ALTER TABLE public.orders_3d ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_3d_select_own ON public.orders_3d;
DROP POLICY IF EXISTS orders_3d_insert_own ON public.orders_3d;
DROP POLICY IF EXISTS orders_3d_update_staff ON public.orders_3d;

CREATE POLICY orders_3d_select_own ON public.orders_3d
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_employee());

CREATE POLICY orders_3d_insert_own ON public.orders_3d
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY orders_3d_update_staff ON public.orders_3d
  FOR UPDATE TO authenticated
  USING (public.is_employee())
  WITH CHECK (public.is_employee());
