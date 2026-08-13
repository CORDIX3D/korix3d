ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_operation_type_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_operation_type_check
  CHECK (
    operation_type = ANY (
      ARRAY[
        'order_created'::text,
        'manual_adjustment'::text,
        'reservation'::text,
        'reservation_released'::text,
        'order_cancelled'::text,
        'order_refunded'::text
      ]
    )
  );

CREATE OR REPLACE FUNCTION public.refund_store_order_and_restore_stock_locked(
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
  locked_product_id uuid;
  previous_quantity integer;
BEGIN
  FOR locked_product_id IN
    SELECT DISTINCT order_item.product_id
    FROM public.store_order_items AS order_item
    WHERE order_item.order_id = p_order_id
      AND order_item.product_id IS NOT NULL
    ORDER BY order_item.product_id
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(locked_product_id::text, 0)
    );
  END LOOP;

  SELECT *
  INTO order_row
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL
    OR order_row.status NOT IN ('paid', 'processing', 'shipped', 'delivered', 'refunded')
  THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE order_id = p_order_id
      AND operation_type = 'order_refunded'
  ) THEN
    RETURN true;
  END IF;

  FOR item_row IN
    SELECT product_id, quantity
    FROM public.store_order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
    ORDER BY product_id
  LOOP
    SELECT stock_quantity
    INTO previous_quantity
    FROM public.products
    WHERE id = item_row.product_id
    FOR UPDATE;

    IF previous_quantity IS NOT NULL THEN
      UPDATE public.products
      SET
        stock_quantity = previous_quantity + item_row.quantity,
        updated_at = now()
      WHERE id = item_row.product_id;

      INSERT INTO public.stock_movements (
        product_id,
        order_id,
        previous_quantity,
        new_quantity,
        quantity_delta,
        operation_type,
        note
      )
      VALUES (
        item_row.product_id,
        p_order_id,
        previous_quantity,
        previous_quantity + item_row.quantity,
        item_row.quantity,
        'order_refunded',
        'Przywrocenie stanu po pelnym zwrocie Stripe'
      );
    END IF;
  END LOOP;

  UPDATE public.store_orders
  SET
    status = 'refunded',
    checkout_token_hash = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_store_order_and_restore_stock_locked(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.refund_store_order_and_restore_stock_locked(uuid)
TO service_role;
