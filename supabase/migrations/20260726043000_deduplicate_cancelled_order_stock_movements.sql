-- The generic product stock trigger skips an automatic movement only when the
-- order-specific movement already exists. Record the cancellation movement
-- before changing the product quantity so one restoration creates one audit row.

CREATE OR REPLACE FUNCTION public.cancel_store_order_and_restore_stock(
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  order_row public.store_orders%ROWTYPE;
  item_row record;
  previous_quantity integer;
BEGIN
  SELECT * INTO order_row
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL OR order_row.status <> 'pending' THEN
    RETURN false;
  END IF;

  FOR item_row IN
    SELECT product_id, quantity
    FROM public.store_order_items
    WHERE order_id = p_order_id AND product_id IS NOT NULL
  LOOP
    SELECT stock_quantity INTO previous_quantity
    FROM public.products
    WHERE id = item_row.product_id
    FOR UPDATE;

    IF previous_quantity IS NOT NULL THEN
      INSERT INTO public.stock_movements (
        product_id,
        order_id,
        previous_quantity,
        new_quantity,
        quantity_delta,
        operation_type,
        note
      ) VALUES (
        item_row.product_id,
        p_order_id,
        previous_quantity,
        previous_quantity + item_row.quantity,
        item_row.quantity,
        'order_cancelled',
        'Przywrócenie stanu po anulowaniu płatności Stripe'
      );

      UPDATE public.products
      SET
        stock_quantity = previous_quantity + item_row.quantity,
        updated_at = now()
      WHERE id = item_row.product_id;
    END IF;
  END LOOP;

  IF order_row.coupon_id IS NOT NULL THEN
    UPDATE public.discount_codes
    SET used_count = GREATEST(used_count - 1, 0)
    WHERE id = order_row.coupon_id;
  END IF;

  UPDATE public.store_orders
  SET
    status = 'cancelled',
    checkout_token_hash = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) TO service_role;
