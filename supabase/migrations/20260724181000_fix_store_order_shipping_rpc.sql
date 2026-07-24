-- Backwards-compatible RPC overload used by the checkout API.
-- The original function remains available for existing callers.
CREATE OR REPLACE FUNCTION public.create_store_order_with_stock(
  p_user_id uuid,
  p_order_number text,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address jsonb,
  p_billing_address jsonb,
  p_shipping_cost numeric,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
  created_order_id uuid;
  final_total numeric(12, 2);
BEGIN
  IF p_shipping_cost IS NULL OR p_shipping_cost < 0 THEN
    RAISE EXCEPTION 'invalid shipping cost' USING ERRCODE = '22023';
  END IF;

  result := public.create_store_order_with_stock(
    p_user_id,
    p_order_number,
    p_customer_email,
    p_customer_name,
    p_shipping_address,
    p_billing_address,
    p_items
  );

  created_order_id := (result->>'orderId')::uuid;
  UPDATE public.store_orders
  SET shipping_cost = round(p_shipping_cost, 2),
      total = round(total + p_shipping_cost, 2),
      updated_at = now()
  WHERE id = created_order_id
  RETURNING total INTO final_total;

  RETURN result || jsonb_build_object(
    'shippingCost', round(p_shipping_cost, 2),
    'total', final_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) TO service_role;
