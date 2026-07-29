-- Serialize product reservations in a deterministic order. The existing order
-- transaction still owns all business validation and mutations; these wrappers
-- prevent two carts containing the same products in a different order from
-- deadlocking while acquiring product row locks.

CREATE OR REPLACE FUNCTION public.create_store_order_with_stock_locked(
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
  locked_product_id uuid;
BEGIN
  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'invalid cart items' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS entry(item)
    GROUP BY entry.item->>'id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate cart items' USING ERRCODE = '22023';
  END IF;

  FOR locked_product_id IN
    SELECT DISTINCT (entry.item->>'id')::uuid
    FROM jsonb_array_elements(p_items) AS entry(item)
    ORDER BY 1
  LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(locked_product_id::text, 0)
    );
  END LOOP;

  RETURN public.create_store_order_with_stock(
    p_user_id,
    p_order_number,
    p_customer_email,
    p_customer_name,
    p_shipping_address,
    p_billing_address,
    p_shipping_cost,
    p_coupon_code,
    p_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_store_order_with_stock_locked(
  uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order_with_stock_locked(
  uuid, text, text, text, jsonb, jsonb, numeric, text, jsonb
) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_store_order_and_restore_stock_locked(
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  locked_product_id uuid;
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

  RETURN public.cancel_store_order_and_restore_stock(p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_store_order_and_restore_stock_locked(uuid)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_store_order_and_restore_stock_locked(uuid)
TO service_role;
