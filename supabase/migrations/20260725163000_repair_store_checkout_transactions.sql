-- Repair the transactional checkout functions after the compatibility wrapper
-- accidentally replaced the shipping-aware implementation.

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
  item jsonb;
  product_row public.products%ROWTYPE;
  requested_quantity integer;
  line_total numeric(12, 2);
  subtotal_amount numeric(12, 2) := 0;
  shipping_amount numeric(12, 2);
  total_amount numeric(12, 2);
  vat_amount numeric(12, 2);
  created_order_id uuid;
  created_lines jsonb := '[]'::jsonb;
BEGIN
  IF p_shipping_cost IS NULL
     OR p_shipping_cost = 'NaN'::numeric
     OR p_shipping_cost < 0
     OR p_shipping_cost > 10000 THEN
    RAISE EXCEPTION 'invalid shipping cost' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid cart items' USING ERRCODE = '22023';
  END IF;

  shipping_amount := round(p_shipping_cost, 2);

  INSERT INTO public.store_orders (
    order_number,
    user_id,
    status,
    customer_email,
    customer_name,
    shipping_address,
    billing_address,
    subtotal,
    discount_amount,
    shipping_cost,
    vat_amount,
    total,
    notes
  )
  VALUES (
    p_order_number,
    p_user_id,
    'pending',
    p_customer_email,
    p_customer_name,
    p_shipping_address,
    p_billing_address,
    0,
    0,
    shipping_amount,
    0,
    shipping_amount,
    'Zamówienie oczekuje na potwierdzenie płatności Stripe.'
  )
  RETURNING id INTO created_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    requested_quantity := (item->>'quantity')::integer;

    IF requested_quantity IS NULL
       OR requested_quantity < 1
       OR requested_quantity > 99 THEN
      RAISE EXCEPTION 'invalid item quantity' USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO product_row
    FROM public.products
    WHERE id = (item->>'id')::uuid
      AND active IS TRUE
    FOR UPDATE;

    IF product_row.id IS NULL THEN
      RAISE EXCEPTION 'product unavailable' USING ERRCODE = 'P0002';
    END IF;

    IF product_row.stock_quantity < requested_quantity THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;

    line_total := round((product_row.price * requested_quantity)::numeric, 2);
    subtotal_amount := subtotal_amount + line_total;

    INSERT INTO public.store_order_items (
      order_id,
      product_id,
      sku,
      name,
      quantity,
      unit_price,
      total
    )
    VALUES (
      created_order_id,
      product_row.id,
      product_row.sku,
      product_row.name,
      requested_quantity,
      product_row.price,
      line_total
    );

    INSERT INTO public.stock_movements (
      product_id,
      order_id,
      previous_quantity,
      new_quantity,
      quantity_delta,
      operation_type,
      note,
      changed_by
    )
    VALUES (
      product_row.id,
      created_order_id,
      product_row.stock_quantity,
      product_row.stock_quantity - requested_quantity,
      -requested_quantity,
      'order_created',
      'Automatyczne zmniejszenie stanu po zamówieniu sklepowym',
      p_user_id
    );

    UPDATE public.products
    SET
      stock_quantity = product_row.stock_quantity - requested_quantity,
      updated_at = now()
    WHERE id = product_row.id;

    created_lines := created_lines || jsonb_build_object(
      'product_id', product_row.id,
      'sku', product_row.sku,
      'name', product_row.name,
      'quantity', requested_quantity,
      'unit_price', product_row.price,
      'total', line_total
    );
  END LOOP;

  total_amount := subtotal_amount + shipping_amount;
  vat_amount := round((total_amount * 23 / 123)::numeric, 2);

  UPDATE public.store_orders
  SET
    subtotal = subtotal_amount,
    shipping_cost = shipping_amount,
    vat_amount = vat_amount,
    total = total_amount,
    notes = jsonb_build_object(
      'payment', 'stripe_checkout',
      'shipping_cost', shipping_amount,
      'lines', created_lines
    )::text,
    updated_at = now()
  WHERE id = created_order_id;

  RETURN jsonb_build_object(
    'orderId', created_order_id,
    'orderNumber', p_order_number,
    'subtotal', subtotal_amount,
    'shippingCost', shipping_amount,
    'vatAmount', vat_amount,
    'total', total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_with_stock(
  uuid, text, text, text, jsonb, jsonb, numeric, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(
  uuid, text, text, text, jsonb, jsonb, numeric, jsonb
) TO service_role;

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
  SELECT *
  INTO order_row
  FROM public.store_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF order_row.id IS NULL OR order_row.status <> 'pending' THEN
    RETURN false;
  END IF;

  FOR item_row IN
    SELECT product_id, quantity
    FROM public.store_order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
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
        'order_cancelled',
        'Przywrócenie stanu po anulowaniu płatności Stripe'
      );
    END IF;
  END LOOP;

  UPDATE public.store_orders
  SET
    status = 'cancelled',
    checkout_token_hash = NULL,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_store_order_and_restore_stock(uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock(uuid)
  TO service_role;
