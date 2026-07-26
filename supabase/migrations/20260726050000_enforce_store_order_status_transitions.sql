-- Keep checkout, Stripe webhooks and staff actions on one order workflow even
-- when a request bypasses the application UI.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'store_orders_status_check'
  ) THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_status_check
      CHECK (status IN (
        'pending',
        'paid',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refunded'
      )) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_valid_store_order_status_transition(
  p_current text,
  p_next text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_current
    WHEN 'pending' THEN p_next IN ('pending', 'paid', 'cancelled')
    WHEN 'paid' THEN p_next IN ('paid', 'processing', 'refunded')
    WHEN 'processing' THEN p_next IN ('processing', 'shipped', 'refunded')
    WHEN 'shipped' THEN p_next IN ('shipped', 'delivered', 'refunded')
    WHEN 'delivered' THEN p_next IN ('delivered', 'refunded')
    WHEN 'cancelled' THEN p_next = 'cancelled'
    WHEN 'refunded' THEN p_next = 'refunded'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_store_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' THEN
      RAISE EXCEPTION 'new store order must start with status pending'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_valid_store_order_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'invalid store order status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF COALESCE(auth.role(), 'postgres') NOT IN ('service_role', 'postgres') AND (
    (OLD.status = 'pending' AND NEW.status IN ('paid', 'cancelled'))
    OR (OLD.status <> 'refunded' AND NEW.status = 'refunded')
  ) THEN
    RAISE EXCEPTION 'store order payment status requires service role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_store_order_checkout_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), 'postgres') NOT IN ('service_role', 'postgres') AND (
    OLD.order_number IS DISTINCT FROM NEW.order_number
    OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.customer_email IS DISTINCT FROM NEW.customer_email
    OR OLD.customer_name IS DISTINCT FROM NEW.customer_name
    OR OLD.shipping_address IS DISTINCT FROM NEW.shipping_address
    OR OLD.billing_address IS DISTINCT FROM NEW.billing_address
    OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
    OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount
    OR OLD.shipping_cost IS DISTINCT FROM NEW.shipping_cost
    OR OLD.vat_amount IS DISTINCT FROM NEW.vat_amount
    OR OLD.total IS DISTINCT FROM NEW.total
    OR OLD.coupon_code IS DISTINCT FROM NEW.coupon_code
    OR OLD.coupon_id IS DISTINCT FROM NEW.coupon_id
    OR OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id
    OR OLD.stripe_payment_intent_id IS DISTINCT FROM NEW.stripe_payment_intent_id
    OR OLD.checkout_token_hash IS DISTINCT FROM NEW.checkout_token_hash
  ) THEN
    RAISE EXCEPTION 'store order checkout terms are protected'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_orders_00_validate_insert ON public.store_orders;
CREATE TRIGGER store_orders_00_validate_insert
  BEFORE INSERT ON public.store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_order_status_transition();

DROP TRIGGER IF EXISTS store_orders_00_validate_status ON public.store_orders;
CREATE TRIGGER store_orders_00_validate_status
  BEFORE UPDATE OF status ON public.store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_store_order_status_transition();

DROP TRIGGER IF EXISTS store_orders_00_protect_checkout_terms ON public.store_orders;
CREATE TRIGGER store_orders_00_protect_checkout_terms
  BEFORE UPDATE OF
    order_number,
    user_id,
    customer_email,
    customer_name,
    shipping_address,
    billing_address,
    subtotal,
    discount_amount,
    shipping_cost,
    vat_amount,
    total,
    coupon_code,
    coupon_id,
    stripe_session_id,
    stripe_payment_intent_id,
    checkout_token_hash
  ON public.store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_store_order_checkout_terms();

REVOKE ALL ON FUNCTION public.is_valid_store_order_status_transition(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_store_order_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_store_order_checkout_terms() FROM PUBLIC;
