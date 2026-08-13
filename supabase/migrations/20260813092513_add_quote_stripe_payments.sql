ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

ALTER TABLE public.orders_3d
  DROP CONSTRAINT IF EXISTS orders_3d_payment_status_check;

ALTER TABLE public.orders_3d
  ADD CONSTRAINT orders_3d_payment_status_check
  CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

CREATE UNIQUE INDEX IF NOT EXISTS orders_3d_stripe_session_id_uidx
  ON public.orders_3d (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_3d_stripe_payment_intent_id_uidx
  ON public.orders_3d (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

GRANT SELECT (
  payment_status,
  paid_at,
  refunded_at
) ON public.orders_3d TO authenticated;

CREATE OR REPLACE FUNCTION public.release_quote_payment_locked(
  p_order_id uuid,
  p_session_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.orders_3d%ROWTYPE;
  locked_filament_id uuid;
BEGIN
  SELECT filament_id
  INTO locked_filament_id
  FROM public.orders_3d
  WHERE id = p_order_id;

  IF locked_filament_id IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(locked_filament_id::text, 0)
    );
  END IF;

  SELECT *
  INTO order_row
  FROM public.orders_3d
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL THEN
    RETURN false;
  END IF;

  IF order_row.payment_status = 'paid' THEN
    RETURN false;
  END IF;

  IF p_session_id IS NOT NULL
    AND order_row.stripe_session_id IS DISTINCT FROM p_session_id
  THEN
    RETURN false;
  END IF;

  IF order_row.status = 'quoted'
    AND order_row.stripe_session_id IS NULL
  THEN
    RETURN true;
  END IF;

  IF order_row.status <> 'accepted' THEN
    RETURN false;
  END IF;

  UPDATE public.orders_3d
  SET
    status = 'quoted',
    payment_status = 'failed',
    stripe_session_id = NULL,
    stripe_payment_intent_id = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_quote_payment_locked(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_cents integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.orders_3d%ROWTYPE;
BEGIN
  SELECT *
  INTO order_row
  FROM public.orders_3d
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL
    OR p_session_id IS NULL
    OR p_payment_intent_id IS NULL
    OR p_amount_cents <> pg_catalog.round(order_row.final_price * 100)::integer
  THEN
    RETURN false;
  END IF;

  IF order_row.payment_status = 'paid' THEN
    RETURN order_row.stripe_session_id = p_session_id
      AND order_row.stripe_payment_intent_id = p_payment_intent_id;
  END IF;

  IF order_row.status <> 'accepted'
    OR order_row.payment_status <> 'pending'
    OR order_row.stripe_session_id IS DISTINCT FROM p_session_id
  THEN
    RETURN false;
  END IF;

  UPDATE public.orders_3d
  SET
    status = 'queued',
    payment_status = 'paid',
    stripe_payment_intent_id = p_payment_intent_id,
    paid_at = now(),
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_quote_payment_locked(
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.orders_3d%ROWTYPE;
BEGIN
  SELECT *
  INTO order_row
  FROM public.orders_3d
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL THEN
    RETURN false;
  END IF;

  IF order_row.payment_status = 'refunded' THEN
    RETURN true;
  END IF;

  IF order_row.payment_status <> 'paid' THEN
    RETURN false;
  END IF;

  UPDATE public.orders_3d
  SET
    status = 'cancelled',
    payment_status = 'refunded',
    refunded_at = now(),
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.release_quote_payment_locked(uuid, text)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_quote_payment_locked(uuid, text, text, integer)
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.refund_quote_payment_locked(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.release_quote_payment_locked(uuid, text)
TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quote_payment_locked(uuid, text, text, integer)
TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_quote_payment_locked(uuid)
TO service_role;
