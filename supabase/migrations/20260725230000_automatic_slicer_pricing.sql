-- Convert deterministic Creality Print results into a customer-ready quote.

ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS delivery_type text,
  ADD COLUMN IF NOT EXISTS delivery_cost numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.orders_3d
SET delivery_cost = GREATEST(COALESCE(delivery_cost, 0), 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_delivery_cost_check'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_delivery_cost_check
      CHECK (delivery_cost BETWEEN 0 AND 10000) NOT VALID;
  END IF;
END $$;

INSERT INTO public.settings (key, value, label, category)
VALUES
  ('express_surcharge', '50', 'Dopłata za tryb Express', 'pricing'),
  ('urgent_surcharge', '100', 'Dopłata za tryb Pilne', 'pricing')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.finish_slicing_job(
  p_job_id uuid,
  p_status text,
  p_result jsonb DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_slicer_name text DEFAULT 'Creality Print',
  p_slicer_version text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_order_id uuid;
  pending_count integer;
  completed_count integer;
  failed_count integer;
  total_seconds numeric;
  total_grams numeric;
  aggregated_result jsonb;
  quote_order public.orders_3d%ROWTYPE;
  material_price_per_kg numeric;
  filament_remaining_grams numeric;
  printing_hour_rate numeric;
  electricity_hour_rate numeric;
  maintenance_hour_rate numeric;
  packaging_rate numeric;
  margin_rate numeric;
  vat_rate_value numeric;
  minimum_order_value numeric;
  express_surcharge numeric;
  urgent_surcharge numeric;
  priority_surcharge numeric := 0;
  calculated_hours numeric;
  calculated_grams numeric;
  calculated_material_cost numeric;
  calculated_printing_cost numeric;
  calculated_electricity_cost numeric;
  calculated_packaging_cost numeric;
  calculated_margin numeric;
  calculated_vat numeric;
  calculated_final_price numeric;
  cost_base numeric;
  pricing_ready boolean := false;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'invalid terminal status' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'completed' AND (
    p_result IS NULL
    OR jsonb_typeof(p_result) <> 'object'
    OR COALESCE((p_result->>'printing_time_seconds')::numeric, 0) <= 0
    OR COALESCE((p_result->>'filament_used_grams')::numeric, 0) <= 0
  ) THEN
    RAISE EXCEPTION 'invalid slicing result' USING ERRCODE = '22023';
  END IF;

  UPDATE public.slicing_jobs
  SET
    status = p_status,
    result = CASE WHEN p_status = 'completed' THEN p_result ELSE NULL END,
    error_message = CASE
      WHEN p_status = 'failed' THEN left(NULLIF(trim(COALESCE(p_error_message, '')), ''), 1000)
      ELSE NULL
    END,
    slicer_name = NULLIF(trim(COALESCE(p_slicer_name, '')), ''),
    slicer_version = NULLIF(trim(COALESCE(p_slicer_version, '')), ''),
    completed_at = now(),
    updated_at = now()
  WHERE id = p_job_id
    AND status = 'processing'
  RETURNING order_id INTO target_order_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT
    count(*) FILTER (WHERE status IN ('pending', 'processing')),
    count(*) FILTER (WHERE status = 'completed'),
    count(*) FILTER (WHERE status = 'failed'),
    COALESCE(sum((result->>'printing_time_seconds')::numeric) FILTER (WHERE status = 'completed'), 0),
    COALESCE(sum((result->>'filament_used_grams')::numeric) FILTER (WHERE status = 'completed'), 0),
    jsonb_build_object(
      'jobs', jsonb_agg(
        jsonb_build_object(
          'id', id,
          'file_index', file_index,
          'status', status,
          'result', result,
          'error', error_message
        )
        ORDER BY file_index
      ),
      'calculated_at', now()
    )
  INTO
    pending_count,
    completed_count,
    failed_count,
    total_seconds,
    total_grams,
    aggregated_result
  FROM public.slicing_jobs
  WHERE order_id = target_order_id;

  SELECT * INTO quote_order
  FROM public.orders_3d
  WHERE id = target_order_id;

  SELECT
    COALESCE(NULLIF(f.price_per_kg, 0), NULLIF(m.price_per_kg, 0)),
    f.remaining_weight_grams
  INTO material_price_per_kg, filament_remaining_grams
  FROM public.orders_3d AS o
  LEFT JOIN public.filaments AS f ON f.id = o.filament_id
  LEFT JOIN public.materials AS m ON m.id = o.material_id
  WHERE o.id = target_order_id;

  SELECT
    COALESCE(max(CASE WHEN key = 'printing_hour_cost' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 50),
    COALESCE(max(CASE WHEN key = 'electricity_hour_cost' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 2),
    COALESCE(max(CASE WHEN key = 'maintenance_hour_cost' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 5),
    COALESCE(max(CASE WHEN key = 'packaging_cost' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 5),
    COALESCE(max(CASE WHEN key = 'default_margin' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 25),
    COALESCE(max(CASE WHEN key = 'vat_rate' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 23),
    COALESCE(max(CASE WHEN key = 'minimum_order_value' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 20),
    COALESCE(max(CASE WHEN key = 'express_surcharge' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 50),
    COALESCE(max(CASE WHEN key = 'urgent_surcharge' AND replace(trim(value), ',', '.') ~ '^[0-9]+([.][0-9]+)?$' THEN replace(trim(value), ',', '.')::numeric END), 100)
  INTO
    printing_hour_rate,
    electricity_hour_rate,
    maintenance_hour_rate,
    packaging_rate,
    margin_rate,
    vat_rate_value,
    minimum_order_value,
    express_surcharge,
    urgent_surcharge
  FROM public.settings
  WHERE key IN (
    'printing_hour_cost', 'electricity_hour_cost', 'maintenance_hour_cost',
    'packaging_cost', 'default_margin', 'vat_rate', 'minimum_order_value',
    'express_surcharge', 'urgent_surcharge'
  );

  IF completed_count > 0 THEN
    calculated_hours := GREATEST(0.01, round((total_seconds / 3600.0) * COALESCE(quote_order.quantity, 1), 2));
    calculated_grams := GREATEST(0.01, round(total_grams * COALESCE(quote_order.quantity, 1), 2));
  END IF;

  pricing_ready := pending_count = 0
    AND failed_count = 0
    AND completed_count > 0
    AND COALESCE(material_price_per_kg, 0) > 0
    AND COALESCE(filament_remaining_grams, 0) >= calculated_grams
    AND quote_order.status = 'new';

  IF pricing_ready THEN
    calculated_material_cost := round((calculated_grams / 1000.0) * material_price_per_kg, 2);
    calculated_printing_cost := round(calculated_hours * (printing_hour_rate + maintenance_hour_rate), 2);
    calculated_electricity_cost := round(calculated_hours * electricity_hour_rate, 2);
    calculated_packaging_cost := round(packaging_rate, 2);
    priority_surcharge := CASE quote_order.priority
      WHEN 'express' THEN express_surcharge
      WHEN 'urgent' THEN urgent_surcharge
      ELSE 0
    END;
    cost_base := calculated_material_cost
      + calculated_printing_cost
      + calculated_electricity_cost
      + calculated_packaging_cost
      + COALESCE(quote_order.delivery_cost, 0)
      + priority_surcharge;
    calculated_margin := round(cost_base * margin_rate / 100.0, 2);
    calculated_vat := round((cost_base + calculated_margin) * vat_rate_value / 100.0, 2);
    calculated_final_price := round(GREATEST(
      minimum_order_value,
      cost_base + calculated_margin + calculated_vat
    ), 2);

    aggregated_result := aggregated_result || jsonb_build_object(
      'pricing', jsonb_build_object(
        'status', 'ready',
        'material_price_per_kg', material_price_per_kg,
        'printing_hour_rate', printing_hour_rate,
        'electricity_hour_rate', electricity_hour_rate,
        'maintenance_hour_rate', maintenance_hour_rate,
        'delivery_cost', COALESCE(quote_order.delivery_cost, 0),
        'priority_surcharge', priority_surcharge,
        'margin_rate', margin_rate,
        'vat_rate', vat_rate_value,
        'final_price', calculated_final_price
      )
    );
  ELSIF pending_count = 0 AND failed_count = 0 AND completed_count > 0 THEN
    aggregated_result := aggregated_result || jsonb_build_object(
      'pricing', jsonb_build_object(
        'status', 'manual_required',
        'reason', CASE
          WHEN COALESCE(material_price_per_kg, 0) <= 0 THEN 'missing_material_price'
          WHEN COALESCE(filament_remaining_grams, 0) < calculated_grams THEN 'insufficient_filament_stock'
          ELSE 'manual_review'
        END
      )
    );
  END IF;

  UPDATE public.orders_3d
  SET
    slicing_status = CASE
      WHEN pending_count > 0 THEN 'processing'
      WHEN failed_count = 0 THEN 'completed'
      WHEN completed_count > 0 THEN 'partial_failed'
      ELSE 'failed'
    END,
    status = CASE WHEN pricing_ready THEN 'quoted' ELSE status END,
    printing_time_hours = CASE
      WHEN completed_count > 0 THEN calculated_hours
      ELSE NULL
    END,
    filament_used_grams = CASE
      WHEN completed_count > 0 THEN calculated_grams
      ELSE NULL
    END,
    material_cost = CASE WHEN pricing_ready THEN calculated_material_cost ELSE NULL END,
    electricity_cost = CASE WHEN pricing_ready THEN calculated_electricity_cost ELSE NULL END,
    printing_cost = CASE WHEN pricing_ready THEN calculated_printing_cost ELSE NULL END,
    packaging_cost = CASE WHEN pricing_ready THEN calculated_packaging_cost ELSE NULL END,
    margin_amount = CASE WHEN pricing_ready THEN calculated_margin ELSE NULL END,
    vat_amount = CASE WHEN pricing_ready THEN calculated_vat ELSE NULL END,
    final_price = CASE WHEN pricing_ready THEN calculated_final_price ELSE final_price END,
    slicer_name = NULLIF(trim(COALESCE(p_slicer_name, '')), ''),
    slicer_version = NULLIF(trim(COALESCE(p_slicer_version, '')), ''),
    slicing_result = aggregated_result,
    sliced_at = CASE WHEN pending_count = 0 THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = target_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) TO service_role;
