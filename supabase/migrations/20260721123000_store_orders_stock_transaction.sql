-- Production-safe store checkout finalization.
-- Creates normalized order lines, stock movement history and an atomic RPC
-- that verifies availability, inserts the order and decreases stock in one transaction.

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  total numeric(12, 2) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_order_items_order_idx
  ON public.store_order_items (order_id);
CREATE INDEX IF NOT EXISTS store_order_items_product_idx
  ON public.store_order_items (product_id);

ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_order_items_via_order ON public.store_order_items;
CREATE POLICY store_order_items_via_order ON public.store_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.store_orders
      WHERE store_orders.id = store_order_items.order_id
        AND (store_orders.user_id = auth.uid() OR public.is_employee())
    )
  );

DROP POLICY IF EXISTS store_order_items_admin_all ON public.store_order_items;
CREATE POLICY store_order_items_admin_all ON public.store_order_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  previous_quantity integer NOT NULL,
  new_quantity integer NOT NULL CHECK (new_quantity >= 0),
  quantity_delta integer NOT NULL,
  operation_type text NOT NULL CHECK (operation_type IN ('order_created', 'manual_adjustment', 'reservation', 'reservation_released', 'order_cancelled')),
  note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stock_movements_product_created_idx
  ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stock_movements_order_idx
  ON public.stock_movements (order_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stock_movements_staff_read ON public.stock_movements;
CREATE POLICY stock_movements_staff_read ON public.stock_movements
  FOR SELECT TO authenticated
  USING (public.is_employee());

DROP POLICY IF EXISTS stock_movements_admin_all ON public.stock_movements;
CREATE POLICY stock_movements_admin_all ON public.stock_movements
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.create_store_order_with_stock(
  p_user_id uuid,
  p_order_number text,
  p_customer_email text,
  p_customer_name text,
  p_shipping_address jsonb,
  p_billing_address jsonb,
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
    0,
    0,
    0,
    'Zamówienie oczekuje na ręczne potwierdzenie dostawy i płatności.'
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

  vat_amount := round((subtotal_amount * 23 / 123)::numeric, 2);

  UPDATE public.store_orders
  SET
    subtotal = subtotal_amount,
    vat_amount = vat_amount,
    total = subtotal_amount,
    notes = jsonb_build_object(
      'payment', 'manual_confirmation',
      'lines', created_lines
    )::text,
    updated_at = now()
  WHERE id = created_order_id;

  RETURN jsonb_build_object(
    'orderId', created_order_id,
    'orderNumber', p_order_number,
    'subtotal', subtotal_amount,
    'vatAmount', vat_amount,
    'total', subtotal_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock(uuid, text, text, text, jsonb, jsonb, jsonb) TO service_role;

