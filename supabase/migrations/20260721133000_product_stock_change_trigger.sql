-- Automatically log every direct product stock correction.
-- Checkout already writes an order_created movement before updating the product,
-- so this trigger skips duplicates with the same before/after stock values.

CREATE OR REPLACE FUNCTION public.capture_product_stock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(OLD.stock_quantity, 0) = COALESCE(NEW.stock_quantity, 0) THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.stock_quantity, 0) < 0 THEN
    RAISE EXCEPTION 'stock quantity cannot be negative' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stock_movements
    WHERE product_id = NEW.id
      AND previous_quantity = COALESCE(OLD.stock_quantity, 0)
      AND new_quantity = COALESCE(NEW.stock_quantity, 0)
      AND created_at > now() - interval '1 minute'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.stock_movements (
    product_id,
    previous_quantity,
    new_quantity,
    quantity_delta,
    operation_type,
    note,
    changed_by
  )
  VALUES (
    NEW.id,
    COALESCE(OLD.stock_quantity, 0),
    COALESCE(NEW.stock_quantity, 0),
    COALESCE(NEW.stock_quantity, 0) - COALESCE(OLD.stock_quantity, 0),
    'manual_adjustment',
    'Ręczna korekta stanu produktu',
    auth.uid()
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_product_stock_change() FROM PUBLIC;

DROP TRIGGER IF EXISTS product_stock_change ON public.products;
CREATE TRIGGER product_stock_change
  AFTER UPDATE OF stock_quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_product_stock_change();

