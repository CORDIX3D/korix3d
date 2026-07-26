-- Apply administrator-managed discount codes atomically during checkout.
-- A use is reserved with the stock and released when a pending payment is cancelled.

UPDATE public.discount_codes
SET
  code = upper(trim(code)),
  discount_type = CASE WHEN discount_type IN ('percent', 'fixed') THEN discount_type ELSE 'percent' END,
  discount_value = CASE
    WHEN discount_value IS NULL OR discount_value < 0 OR discount_value = 'NaN'::numeric THEN 0
    WHEN discount_type = 'percent' THEN LEAST(discount_value, 100)
    ELSE discount_value
  END,
  min_order_value = GREATEST(COALESCE(min_order_value, 0), 0),
  max_uses = CASE WHEN max_uses IS NULL THEN NULL ELSE GREATEST(max_uses, 1) END,
  used_count = GREATEST(COALESCE(used_count, 0), 0),
  active = COALESCE(active, true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.discount_codes'::regclass
      AND conname = 'discount_codes_type_check'
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_type_check
      CHECK (discount_type IN ('percent', 'fixed')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.discount_codes'::regclass
      AND conname = 'discount_codes_value_check'
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_value_check
      CHECK (
        discount_value >= 0
        AND discount_value <> 'NaN'::numeric
        AND (discount_type <> 'percent' OR discount_value <= 100)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.discount_codes'::regclass
      AND conname = 'discount_codes_usage_check'
  ) THEN
    ALTER TABLE public.discount_codes
      ADD CONSTRAINT discount_codes_usage_check
      CHECK (
        min_order_value >= 0
        AND used_count >= 0
        AND (max_uses IS NULL OR max_uses >= 1)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS coupon_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.store_orders'::regclass
      AND conname = 'store_orders_coupon_id_fkey'
  ) THEN
    ALTER TABLE public.store_orders
      ADD CONSTRAINT store_orders_coupon_id_fkey
      FOREIGN KEY (coupon_id) REFERENCES public.discount_codes(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

UPDATE public.store_orders AS order_row
SET coupon_id = coupon.id
FROM public.discount_codes AS coupon
WHERE order_row.coupon_id IS NULL
  AND order_row.coupon_code IS NOT NULL
  AND lower(order_row.coupon_code) = lower(coupon.code);

CREATE INDEX IF NOT EXISTS store_orders_coupon_id_idx
  ON public.store_orders (coupon_id)
  WHERE coupon_id IS NOT NULL;

-- Coupon discovery is available only through the rate-limited validation API.
DROP POLICY IF EXISTS discount_codes_user_read ON public.discount_codes;
DROP POLICY IF EXISTS discount_codes_active_read ON public.discount_codes;
REVOKE ALL ON public.discount_codes FROM anon, authenticated;
GRANT ALL ON public.discount_codes TO service_role;

CREATE OR REPLACE FUNCTION public.create_store_order_with_stock(
  p_user_id uuid,
  p_order_number text,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address jsonb,
  p_billing_address jsonb,
  p_shipping_cost numeric,
  p_coupon_code text,
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
  coupon_row public.discount_codes%ROWTYPE;
  requested_quantity integer;
  line_total numeric(12,2);
  unit_cost_amount numeric(12,2);
  subtotal_amount numeric(12,2) := 0;
  discount_amount_value numeric(12,2) := 0;
  shipping_amount numeric(12,2);
  total_amount numeric(12,2);
  vat_amount numeric(12,2);
  normalized_coupon text := upper(nullif(trim(p_coupon_code), ''));
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

  IF normalized_coupon IS NOT NULL
     AND normalized_coupon !~ '^[A-Z0-9_-]{2,40}$' THEN
    RAISE EXCEPTION 'invalid coupon' USING ERRCODE = 'P0003';
  END IF;

  shipping_amount := round(p_shipping_cost, 2);

  INSERT INTO public.store_orders (
    order_number, user_id, status, customer_email, customer_name,
    shipping_address, billing_address, subtotal, discount_amount,
    shipping_cost, vat_amount, total, coupon_id, coupon_code, notes
  )
  VALUES (
    p_order_number, p_user_id, 'pending', p_customer_email, p_customer_name,
    p_shipping_address, p_billing_address, 0, 0,
    shipping_amount, 0, shipping_amount, NULL, NULL,
    'Zamówienie oczekuje na potwierdzenie płatności Stripe.'
  )
  RETURNING id INTO created_order_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    requested_quantity := (item->>'quantity')::integer;
    IF requested_quantity IS NULL OR requested_quantity < 1 OR requested_quantity > 99 THEN
      RAISE EXCEPTION 'invalid item quantity' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = (item->>'id')::uuid AND active IS TRUE
    FOR UPDATE;

    IF product_row.id IS NULL THEN
      RAISE EXCEPTION 'product unavailable' USING ERRCODE = 'P0002';
    END IF;
    IF product_row.stock_quantity < requested_quantity THEN
      RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
    END IF;

    line_total := round((product_row.price * requested_quantity)::numeric, 2);
    unit_cost_amount := round(GREATEST(COALESCE(product_row.cost_price, 0), 0)::numeric, 2);
    subtotal_amount := subtotal_amount + line_total;

    INSERT INTO public.store_order_items (
      order_id, product_id, sku, name, quantity, unit_price, unit_cost, total
    ) VALUES (
      created_order_id, product_row.id, product_row.sku, product_row.name,
      requested_quantity, product_row.price, unit_cost_amount, line_total
    );

    INSERT INTO public.stock_movements (
      product_id, order_id, previous_quantity, new_quantity,
      quantity_delta, operation_type, note, changed_by
    ) VALUES (
      product_row.id, created_order_id, product_row.stock_quantity,
      product_row.stock_quantity - requested_quantity, -requested_quantity,
      'order_created', 'Automatyczne zmniejszenie stanu po zamówieniu sklepowym',
      p_user_id
    );

    UPDATE public.products
    SET stock_quantity = product_row.stock_quantity - requested_quantity,
        updated_at = now()
    WHERE id = product_row.id;

    created_lines := created_lines || jsonb_build_object(
      'product_id', product_row.id, 'sku', product_row.sku,
      'name', product_row.name, 'quantity', requested_quantity,
      'unit_price', product_row.price, 'total', line_total
    );
  END LOOP;

  IF normalized_coupon IS NOT NULL THEN
    SELECT * INTO coupon_row
    FROM public.discount_codes
    WHERE lower(code) = lower(normalized_coupon)
    FOR UPDATE;

    IF coupon_row.id IS NULL
       OR coupon_row.active IS NOT TRUE
       OR coupon_row.discount_value IS NULL
       OR coupon_row.discount_value <= 0
       OR coupon_row.discount_value = 'NaN'::numeric
       OR (coupon_row.expires_at IS NOT NULL AND coupon_row.expires_at <= now())
       OR (coupon_row.max_uses IS NOT NULL AND coupon_row.used_count >= coupon_row.max_uses)
       OR subtotal_amount < COALESCE(coupon_row.min_order_value, 0) THEN
      RAISE EXCEPTION 'invalid coupon' USING ERRCODE = 'P0003';
    END IF;

    IF coupon_row.discount_type = 'percent' THEN
      IF coupon_row.discount_value > 100 THEN
        RAISE EXCEPTION 'invalid coupon' USING ERRCODE = 'P0003';
      END IF;
      discount_amount_value := round(subtotal_amount * coupon_row.discount_value / 100, 2);
    ELSIF coupon_row.discount_type = 'fixed' THEN
      discount_amount_value := round(LEAST(subtotal_amount, coupon_row.discount_value), 2);
    ELSE
      RAISE EXCEPTION 'invalid coupon' USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.discount_codes
    SET used_count = used_count + 1
    WHERE id = coupon_row.id;
  END IF;

  total_amount := subtotal_amount - discount_amount_value + shipping_amount;
  IF total_amount <= 0 THEN
    RAISE EXCEPTION 'invalid coupon' USING ERRCODE = 'P0003';
  END IF;
  vat_amount := round((total_amount * 23 / 123)::numeric, 2);

  UPDATE public.store_orders
  SET subtotal = subtotal_amount,
      discount_amount = discount_amount_value,
      shipping_cost = shipping_amount,
      vat_amount = vat_amount,
      total = total_amount,
      coupon_id = CASE WHEN normalized_coupon IS NULL THEN NULL ELSE coupon_row.id END,
      coupon_code = CASE WHEN normalized_coupon IS NULL THEN NULL ELSE coupon_row.code END,
      notes = jsonb_build_object(
        'payment', 'stripe_checkout',
        'shipping_cost', shipping_amount,
        'discount_amount', discount_amount_value,
        'coupon_code', CASE WHEN normalized_coupon IS NULL THEN NULL ELSE coupon_row.code END,
        'lines', created_lines
      )::text,
      updated_at = now()
  WHERE id = created_order_id;

  RETURN jsonb_build_object(
    'orderId', created_order_id,
    'orderNumber', p_order_number,
    'subtotal', subtotal_amount,
    'discountAmount', discount_amount_value,
    'couponCode', CASE WHEN normalized_coupon IS NULL THEN NULL ELSE coupon_row.code END,
    'shippingCost', shipping_amount,
    'vatAmount', vat_amount,
    'total', total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_with_stock(
  uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(
  uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb
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
      UPDATE public.products
      SET stock_quantity = previous_quantity + item_row.quantity,
          updated_at = now()
      WHERE id = item_row.product_id;

      INSERT INTO public.stock_movements (
        product_id, order_id, previous_quantity, new_quantity,
        quantity_delta, operation_type, note
      ) VALUES (
        item_row.product_id, p_order_id, previous_quantity,
        previous_quantity + item_row.quantity, item_row.quantity,
        'order_cancelled', 'Przywrócenie stanu po anulowaniu płatności Stripe'
      );
    END IF;
  END LOOP;

  IF order_row.coupon_id IS NOT NULL THEN
    UPDATE public.discount_codes
    SET used_count = GREATEST(used_count - 1, 0)
    WHERE id = order_row.coupon_id;
  END IF;

  UPDATE public.store_orders
  SET status = 'cancelled', checkout_token_hash = NULL, updated_at = now()
  WHERE id = p_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock(uuid) TO service_role;
