-- Keep the price shown after remote slicing tied to the terms that were valid
-- when the customer submitted the quote. Later admin price changes must only
-- affect new requests.

ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS pricing_settings_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_3d_pricing_snapshot_object_check'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_pricing_snapshot_object_check
      CHECK (
        pricing_settings_snapshot IS NULL
        OR jsonb_typeof(pricing_settings_snapshot) = 'object'
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.orders_3d.pricing_settings_snapshot IS
  'Immutable pricing, material, priority and delivery terms captured when a quote is created.';

CREATE OR REPLACE FUNCTION public.apply_order_3d_pricing_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  snapshot jsonb := OLD.pricing_settings_snapshot;
  material_price_per_kg numeric;
  printing_hour_rate numeric;
  electricity_hour_rate numeric;
  maintenance_hour_rate numeric;
  packaging_rate numeric;
  margin_rate numeric;
  vat_rate_value numeric;
  minimum_order_value numeric;
  express_surcharge numeric;
  urgent_surcharge numeric;
  delivery_rate numeric;
  priority_surcharge numeric;
  calculated_material_cost numeric;
  calculated_printing_cost numeric;
  calculated_electricity_cost numeric;
  calculated_packaging_cost numeric;
  calculated_margin numeric;
  calculated_vat numeric;
  calculated_final_price numeric;
  cost_base numeric;
BEGIN
  IF OLD.pricing_settings_snapshot IS DISTINCT FROM NEW.pricing_settings_snapshot THEN
    RAISE EXCEPTION 'quote pricing snapshot is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF snapshot IS NOT NULL AND (
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
  ) THEN
    RAISE EXCEPTION 'quote inputs with a pricing snapshot are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NOT (
    OLD.status = 'new'
    AND NEW.status = 'quoted'
    AND NEW.slicing_status = 'completed'
    AND snapshot IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(snapshot) <> 'object'
    OR NOT (snapshot ?& ARRAY[
      'printing_hour_cost',
      'electricity_hour_cost',
      'maintenance_hour_cost',
      'packaging_cost',
      'default_margin',
      'vat_rate',
      'minimum_order_value',
      'express_surcharge',
      'urgent_surcharge',
      'material_price_per_kg',
      'delivery_cost',
      'priority',
      'captured_at'
    ]::text[])
    OR (snapshot->>'printing_hour_cost') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'electricity_hour_cost') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'maintenance_hour_cost') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'packaging_cost') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'default_margin') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'vat_rate') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'minimum_order_value') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'express_surcharge') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'urgent_surcharge') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'material_price_per_kg') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'delivery_cost') !~ '^[0-9]+([.][0-9]+)?$'
    OR (snapshot->>'priority') NOT IN ('standard', 'express', 'urgent')
    OR COALESCE(snapshot->>'captured_at', '') = ''
  THEN
    RAISE EXCEPTION 'quote pricing snapshot is incomplete'
      USING ERRCODE = '23514';
  END IF;

  material_price_per_kg := (snapshot->>'material_price_per_kg')::numeric;
  printing_hour_rate := (snapshot->>'printing_hour_cost')::numeric;
  electricity_hour_rate := (snapshot->>'electricity_hour_cost')::numeric;
  maintenance_hour_rate := (snapshot->>'maintenance_hour_cost')::numeric;
  packaging_rate := (snapshot->>'packaging_cost')::numeric;
  margin_rate := (snapshot->>'default_margin')::numeric;
  vat_rate_value := (snapshot->>'vat_rate')::numeric;
  minimum_order_value := (snapshot->>'minimum_order_value')::numeric;
  express_surcharge := (snapshot->>'express_surcharge')::numeric;
  urgent_surcharge := (snapshot->>'urgent_surcharge')::numeric;
  delivery_rate := (snapshot->>'delivery_cost')::numeric;

  IF material_price_per_kg <= 0 OR material_price_per_kg > 1000000
    OR printing_hour_rate < 0 OR printing_hour_rate > 10000
    OR electricity_hour_rate < 0 OR electricity_hour_rate > 10000
    OR maintenance_hour_rate < 0 OR maintenance_hour_rate > 10000
    OR packaging_rate < 0 OR packaging_rate > 10000
    OR margin_rate < 0 OR margin_rate > 1000
    OR vat_rate_value < 0 OR vat_rate_value > 100
    OR minimum_order_value < 0 OR minimum_order_value > 1000000
    OR express_surcharge < 0 OR express_surcharge > 100000
    OR urgent_surcharge < 0 OR urgent_surcharge > 100000
    OR delivery_rate < 0 OR delivery_rate > 10000
    OR (snapshot->>'priority') IS DISTINCT FROM NEW.priority
    OR delivery_rate IS DISTINCT FROM NEW.delivery_cost
    OR COALESCE(NEW.printing_time_hours, 0) <= 0
    OR COALESCE(NEW.filament_used_grams, 0) <= 0
  THEN
    RAISE EXCEPTION 'quote pricing snapshot contains invalid values'
      USING ERRCODE = '23514';
  END IF;

  calculated_material_cost := round(
    (NEW.filament_used_grams / 1000.0) * material_price_per_kg,
    2
  );
  calculated_printing_cost := round(
    NEW.printing_time_hours * (printing_hour_rate + maintenance_hour_rate),
    2
  );
  calculated_electricity_cost := round(
    NEW.printing_time_hours * electricity_hour_rate,
    2
  );
  calculated_packaging_cost := round(packaging_rate, 2);
  priority_surcharge := CASE snapshot->>'priority'
    WHEN 'express' THEN express_surcharge
    WHEN 'urgent' THEN urgent_surcharge
    ELSE 0
  END;
  cost_base := calculated_material_cost
    + calculated_printing_cost
    + calculated_electricity_cost
    + calculated_packaging_cost
    + delivery_rate
    + priority_surcharge;
  calculated_margin := round(cost_base * margin_rate / 100.0, 2);
  calculated_vat := round(
    (cost_base + calculated_margin) * vat_rate_value / 100.0,
    2
  );
  calculated_final_price := round(GREATEST(
    minimum_order_value,
    cost_base + calculated_margin + calculated_vat
  ), 2);

  NEW.material_cost := calculated_material_cost;
  NEW.electricity_cost := calculated_electricity_cost;
  NEW.printing_cost := calculated_printing_cost;
  NEW.packaging_cost := calculated_packaging_cost;
  NEW.margin_amount := calculated_margin;
  NEW.vat_amount := calculated_vat;
  NEW.final_price := calculated_final_price;
  NEW.slicing_result := COALESCE(NEW.slicing_result, '{}'::jsonb)
    || jsonb_build_object(
      'pricing',
      jsonb_build_object(
        'status', 'ready',
        'source', 'quote_snapshot',
        'captured_at', snapshot->>'captured_at',
        'material_price_per_kg', material_price_per_kg,
        'printing_hour_rate', printing_hour_rate,
        'electricity_hour_rate', electricity_hour_rate,
        'maintenance_hour_rate', maintenance_hour_rate,
        'delivery_cost', delivery_rate,
        'priority_surcharge', priority_surcharge,
        'margin_rate', margin_rate,
        'vat_rate', vat_rate_value,
        'final_price', calculated_final_price
      )
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_3d_00_apply_pricing_snapshot ON public.orders_3d;
CREATE TRIGGER orders_3d_00_apply_pricing_snapshot
  BEFORE UPDATE ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_order_3d_pricing_snapshot();

REVOKE ALL ON FUNCTION public.apply_order_3d_pricing_snapshot() FROM PUBLIC;
