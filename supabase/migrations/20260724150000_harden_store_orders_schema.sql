-- Complete the store order table used by checkout, customer panel and admin.
-- Additive migration: existing orders are preserved and normalized.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  customer_email text NOT NULL,
  customer_name text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  stripe_session_id text,
  stripe_payment_intent_id text,
  tracking_number text,
  coupon_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS shipping_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS billing_address jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.store_orders
SET
  order_number = COALESCE(NULLIF(trim(order_number), ''), 'SK-ARCH-' || upper(left(id::text, 8))),
  status = COALESCE(NULLIF(trim(status), ''), 'pending'),
  customer_email = lower(COALESCE(NULLIF(trim(customer_email), ''), 'brak-adresu@invalid.local')),
  shipping_address = COALESCE(shipping_address, '{}'::jsonb),
  billing_address = COALESCE(billing_address, '{}'::jsonb),
  subtotal = GREATEST(COALESCE(subtotal, 0), 0),
  discount_amount = GREATEST(COALESCE(discount_amount, 0), 0),
  shipping_cost = GREATEST(COALESCE(shipping_cost, 0), 0),
  vat_amount = GREATEST(COALESCE(vat_amount, 0), 0),
  total = GREATEST(COALESCE(total, 0), 0),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.store_orders
  ALTER COLUMN order_number SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN customer_email SET NOT NULL,
  ALTER COLUMN shipping_address SET DEFAULT '{}'::jsonb,
  ALTER COLUMN shipping_address SET NOT NULL,
  ALTER COLUMN billing_address SET DEFAULT '{}'::jsonb,
  ALTER COLUMN billing_address SET NOT NULL,
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN subtotal SET NOT NULL,
  ALTER COLUMN discount_amount SET DEFAULT 0,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN shipping_cost SET DEFAULT 0,
  ALTER COLUMN shipping_cost SET NOT NULL,
  ALTER COLUMN vat_amount SET DEFAULT 0,
  ALTER COLUMN vat_amount SET NOT NULL,
  ALTER COLUMN total SET DEFAULT 0,
  ALTER COLUMN total SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS store_orders_number_idx
  ON public.store_orders (order_number);
CREATE INDEX IF NOT EXISTS store_orders_user_created_idx
  ON public.store_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_status_created_idx
  ON public.store_orders (status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_orders_user_id_fkey'
  ) THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_store_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_orders_set_updated_at ON public.store_orders;
CREATE TRIGGER store_orders_set_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_store_orders_updated_at();

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_orders_user_read ON public.store_orders;
DROP POLICY IF EXISTS store_orders_staff_update ON public.store_orders;

CREATE POLICY store_orders_user_read ON public.store_orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_employee());

CREATE POLICY store_orders_staff_update ON public.store_orders
  FOR UPDATE TO authenticated
  USING (public.is_employee())
  WITH CHECK (public.is_employee());
