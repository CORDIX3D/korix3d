-- Store checkout: persist admin-configured shipping cost in transactional order creation.

DROP FUNCTION IF EXISTS public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, jsonb);

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
  shipping_amount numeric(12, 2) := round(greatest(coalesce(p_shipping_cost, 0), 0)::numeric, 2);
  total_amount numeric(12, 2);
  vat_amount numeric(12, 2);
  created_order_id uuid;
  created_lines jsonb := '[]'::jsonb;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid cart items' USING ERRCODE = '22023';
  END IF;

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
    'Zamówienie oczekuje na ręczne potwierdzenie płatności.'
  )
  RETURNING id INTO created_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    requested_quantity := (item->>'quantity')::integer;

    IF requested_quantity IS NULL OR requested_quantity < 1 OR requested_quantity > 99 THEN
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
      'payment', 'manual_confirmation',
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

REVOKE ALL ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, numeric, jsonb) TO service_role;
