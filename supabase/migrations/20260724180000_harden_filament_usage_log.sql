-- Ensure reporting has a stable source for filament consumption.
CREATE TABLE IF NOT EXISTS public.filament_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filament_id uuid REFERENCES public.filaments(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders_3d(id) ON DELETE SET NULL,
  grams_used numeric(12, 3) NOT NULL DEFAULT 0,
  material_name text,
  color text,
  min_weight_grams numeric(12, 3),
  remaining_weight_grams numeric(12, 3),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.filament_usage_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS filament_usage_log_created_at_idx
  ON public.filament_usage_log (created_at DESC);

CREATE INDEX IF NOT EXISTS filament_usage_log_filament_idx
  ON public.filament_usage_log (filament_id);

DROP POLICY IF EXISTS "filament_usage_log_employee_read" ON public.filament_usage_log;
CREATE POLICY "filament_usage_log_employee_read"
  ON public.filament_usage_log FOR SELECT TO authenticated
  USING (public.is_employee());

DROP POLICY IF EXISTS "filament_usage_log_employee_write" ON public.filament_usage_log;
CREATE POLICY "filament_usage_log_employee_write"
  ON public.filament_usage_log FOR ALL TO authenticated
  USING (public.is_employee())
  WITH CHECK (public.is_employee());
