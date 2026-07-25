-- Reserve the exact Creality Print filament amount when a customer accepts a quote.
-- The reservation is released if production has not started and the order is reopened
-- or cancelled. Once production starts, it becomes a real usage-log entry.

ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS filament_reserved_grams numeric(12,3) NOT NULL DEFAULT 0;

UPDATE public.orders_3d
SET filament_reserved_grams = GREATEST(COALESCE(filament_reserved_grams, 0), 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_3d_filament_reserved_grams_check'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_filament_reserved_grams_check
      CHECK (filament_reserved_grams BETWEEN 0 AND 1000000) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_order_3d_filament_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  required_grams numeric;
  filament_row public.filaments%ROWTYPE;
  log_actor uuid;
  request_headers jsonb;
  actor_header text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'quoted' AND NEW.status = 'accepted' AND NEW.filament_id IS NOT NULL THEN
    required_grams := round(COALESCE(NEW.filament_used_grams, 0)::numeric, 3);

    IF required_grams <= 0
      OR NEW.slicing_status <> 'completed'
      OR COALESCE(NEW.final_price, 0) <= 0
    THEN
      RAISE EXCEPTION 'quote is not ready for stock reservation'
        USING ERRCODE = '23514';
    END IF;

    SELECT *
    INTO filament_row
    FROM public.filaments
    WHERE id = NEW.filament_id
    FOR UPDATE;

    IF NOT FOUND
      OR filament_row.active IS NOT TRUE
      OR filament_row.remaining_weight_grams < required_grams
    THEN
      RAISE EXCEPTION 'insufficient filament stock'
        USING ERRCODE = '23514';
    END IF;

    UPDATE public.filaments
    SET
      remaining_weight_grams = remaining_weight_grams - required_grams,
      updated_at = now()
    WHERE id = NEW.filament_id;

    NEW.filament_reserved_grams := required_grams;
  END IF;

  IF COALESCE(OLD.filament_reserved_grams, 0) > 0
    AND NEW.status IN ('new', 'quoted', 'cancelled')
  THEN
    UPDATE public.filaments
    SET
      remaining_weight_grams = LEAST(
        original_weight_grams,
        remaining_weight_grams + OLD.filament_reserved_grams
      ),
      updated_at = now()
    WHERE id = OLD.filament_id;

    NEW.filament_reserved_grams := 0;
  ELSIF COALESCE(OLD.filament_reserved_grams, 0) > 0
    AND NEW.status IN ('printing', 'post_processing', 'packed', 'shipped', 'completed')
  THEN
    log_actor := auth.uid();

    IF log_actor IS NULL AND auth.role() = 'service_role' THEN
      BEGIN
        request_headers := NULLIF(current_setting('request.headers', true), '')::jsonb;
        actor_header := request_headers->>'x-korix-actor-id';

        IF actor_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
          log_actor := actor_header::uuid;
        END IF;
      EXCEPTION
        WHEN invalid_text_representation OR invalid_parameter_value THEN
          log_actor := NULL;
      END;
    END IF;

    SELECT id
    INTO log_actor
    FROM public.profiles
    WHERE id = log_actor;

    SELECT *
    INTO filament_row
    FROM public.filaments
    WHERE id = OLD.filament_id;

    INSERT INTO public.filament_usage_log (
      filament_id,
      order_id,
      grams_used,
      material_name,
      color,
      min_weight_grams,
      remaining_weight_grams,
      created_by
    )
    VALUES (
      OLD.filament_id,
      OLD.id,
      OLD.filament_reserved_grams,
      OLD.material_name,
      OLD.color,
      filament_row.min_weight_grams,
      filament_row.remaining_weight_grams,
      log_actor
    );

    NEW.filament_reserved_grams := 0;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_3d_filament_stock ON public.orders_3d;
CREATE TRIGGER orders_3d_filament_stock
  BEFORE UPDATE OF status ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_order_3d_filament_stock();

CREATE OR REPLACE FUNCTION public.accept_order_quote(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_order_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders_3d
  SET
    status = 'accepted',
    updated_at = now()
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'quoted'
    AND COALESCE(final_price, 0) > 0
  RETURNING id INTO changed_order_id;

  RETURN changed_order_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_order_3d_filament_stock() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_order_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_order_quote(uuid) TO authenticated;
