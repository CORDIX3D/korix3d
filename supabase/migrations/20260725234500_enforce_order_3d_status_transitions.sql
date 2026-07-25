-- Keep every order writer on the same production workflow. Application checks
-- provide friendly messages; this trigger is the final protection against a
-- future endpoint or direct service-role update skipping required stages.

CREATE OR REPLACE FUNCTION public.is_valid_order_3d_status_transition(
  p_current text,
  p_next text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_current
    WHEN 'new' THEN p_next IN ('new', 'quoted', 'cancelled')
    WHEN 'quoted' THEN p_next IN ('quoted', 'accepted', 'cancelled')
    WHEN 'accepted' THEN p_next IN ('accepted', 'quoted', 'queued', 'printing', 'cancelled')
    WHEN 'queued' THEN p_next IN ('queued', 'accepted', 'quoted', 'printing', 'cancelled')
    WHEN 'printing' THEN p_next IN ('printing', 'post_processing', 'packed', 'completed', 'cancelled')
    WHEN 'post_processing' THEN p_next IN ('post_processing', 'printing', 'packed', 'completed', 'cancelled')
    WHEN 'packed' THEN p_next IN ('packed', 'post_processing', 'shipped', 'completed', 'cancelled')
    WHEN 'shipped' THEN p_next IN ('shipped', 'completed')
    WHEN 'completed' THEN p_next = 'completed'
    WHEN 'cancelled' THEN p_next = 'cancelled'
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.validate_order_3d_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'new' THEN
      RAISE EXCEPTION 'new order 3d must start with status new'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_valid_order_3d_status_transition(OLD.status, NEW.status) THEN
    RAISE EXCEPTION 'invalid order 3d status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'quoted' AND (
    COALESCE(NEW.final_price, 0) <= 0
    OR COALESCE(NEW.printing_time_hours, 0) <= 0
    OR COALESCE(NEW.filament_used_grams, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'quote pricing is incomplete'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_accepted_order_3d_quote_terms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status NOT IN ('new', 'quoted') AND (
    OLD.material_id IS DISTINCT FROM NEW.material_id
    OR OLD.filament_id IS DISTINCT FROM NEW.filament_id
    OR OLD.material_name IS DISTINCT FROM NEW.material_name
    OR OLD.color IS DISTINCT FROM NEW.color
    OR OLD.color_hex IS DISTINCT FROM NEW.color_hex
    OR OLD.layer_height IS DISTINCT FROM NEW.layer_height
    OR OLD.infill_percent IS DISTINCT FROM NEW.infill_percent
    OR OLD.quantity IS DISTINCT FROM NEW.quantity
    OR OLD.priority IS DISTINCT FROM NEW.priority
    OR OLD.delivery_type IS DISTINCT FROM NEW.delivery_type
    OR OLD.delivery_cost IS DISTINCT FROM NEW.delivery_cost
    OR OLD.notes IS DISTINCT FROM NEW.notes
    OR OLD.printing_time_hours IS DISTINCT FROM NEW.printing_time_hours
    OR OLD.filament_used_grams IS DISTINCT FROM NEW.filament_used_grams
    OR OLD.material_cost IS DISTINCT FROM NEW.material_cost
    OR OLD.electricity_cost IS DISTINCT FROM NEW.electricity_cost
    OR OLD.printing_cost IS DISTINCT FROM NEW.printing_cost
    OR OLD.packaging_cost IS DISTINCT FROM NEW.packaging_cost
    OR OLD.margin_amount IS DISTINCT FROM NEW.margin_amount
    OR OLD.vat_amount IS DISTINCT FROM NEW.vat_amount
    OR OLD.final_price IS DISTINCT FROM NEW.final_price
  ) THEN
    RAISE EXCEPTION 'accepted order 3d quote terms are immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_3d_00_validate_status ON public.orders_3d;
CREATE TRIGGER orders_3d_00_validate_status
  BEFORE UPDATE OF status ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_3d_status_transition();

DROP TRIGGER IF EXISTS orders_3d_00_validate_insert ON public.orders_3d;
CREATE TRIGGER orders_3d_00_validate_insert
  BEFORE INSERT ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_3d_status_transition();

DROP TRIGGER IF EXISTS orders_3d_00_protect_quote_terms ON public.orders_3d;
CREATE TRIGGER orders_3d_00_protect_quote_terms
  BEFORE UPDATE OF
    material_id,
    filament_id,
    material_name,
    color,
    color_hex,
    layer_height,
    infill_percent,
    quantity,
    priority,
    delivery_type,
    delivery_cost,
    notes,
    printing_time_hours,
    filament_used_grams,
    material_cost,
    electricity_cost,
    printing_cost,
    packaging_cost,
    margin_amount,
    vat_amount,
    final_price
  ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_accepted_order_3d_quote_terms();

REVOKE ALL ON FUNCTION public.is_valid_order_3d_status_transition(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_order_3d_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_accepted_order_3d_quote_terms() FROM PUBLIC;
