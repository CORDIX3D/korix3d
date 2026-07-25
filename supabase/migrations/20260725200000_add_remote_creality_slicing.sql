-- Queue-based integration for a remote Creality Print worker.
-- The slicer binary is intentionally not executed in Netlify functions.

ALTER TABLE public.orders_3d
  ADD COLUMN IF NOT EXISTS filament_id uuid,
  ADD COLUMN IF NOT EXISTS infill_percent smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS slicing_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS slicer_name text,
  ADD COLUMN IF NOT EXISTS slicer_version text,
  ADD COLUMN IF NOT EXISTS slicing_result jsonb,
  ADD COLUMN IF NOT EXISTS sliced_at timestamptz;

UPDATE public.orders_3d
SET
  infill_percent = LEAST(100, GREATEST(1, COALESCE(infill_percent, 20))),
  slicing_status = CASE
    WHEN slicing_status IN ('not_started', 'pending', 'processing', 'completed', 'partial_failed', 'failed')
      THEN slicing_status
    ELSE 'not_started'
  END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_filament_id_fkey'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_filament_id_fkey
      FOREIGN KEY (filament_id) REFERENCES public.filaments(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_infill_percent_check'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_infill_percent_check
      CHECK (infill_percent BETWEEN 1 AND 100) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_slicing_status_check'
  ) THEN
    ALTER TABLE public.orders_3d
      ADD CONSTRAINT orders_3d_slicing_status_check
      CHECK (slicing_status IN (
        'not_started', 'pending', 'processing', 'completed', 'partial_failed', 'failed'
      )) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_3d_filament_id_idx
  ON public.orders_3d (filament_id);
CREATE INDEX IF NOT EXISTS orders_3d_slicing_status_idx
  ON public.orders_3d (slicing_status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.slicing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders_3d(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_index integer NOT NULL,
  input_file jsonb NOT NULL,
  material_name text,
  color text,
  infill_percent smallint NOT NULL DEFAULT 20,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  worker_id text,
  printer_profile text,
  process_profile text,
  slicer_name text,
  slicer_version text,
  result jsonb,
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slicing_jobs_order_file_unique UNIQUE (order_id, file_index),
  CONSTRAINT slicing_jobs_file_index_check CHECK (file_index BETWEEN 0 AND 9),
  CONSTRAINT slicing_jobs_infill_check CHECK (infill_percent BETWEEN 1 AND 100),
  CONSTRAINT slicing_jobs_status_check CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS slicing_jobs_queue_idx
  ON public.slicing_jobs (status, requested_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS slicing_jobs_order_idx
  ON public.slicing_jobs (order_id, file_index);
CREATE INDEX IF NOT EXISTS slicing_jobs_user_created_idx
  ON public.slicing_jobs (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_slicing_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slicing_jobs_set_updated_at ON public.slicing_jobs;
CREATE TRIGGER slicing_jobs_set_updated_at
  BEFORE UPDATE ON public.slicing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_slicing_jobs_updated_at();

ALTER TABLE public.slicing_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slicing_jobs_select_own ON public.slicing_jobs;
DROP POLICY IF EXISTS slicing_jobs_select_staff ON public.slicing_jobs;

CREATE POLICY slicing_jobs_select_own ON public.slicing_jobs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY slicing_jobs_select_staff ON public.slicing_jobs
  FOR SELECT TO authenticated
  USING (public.is_employee());

CREATE OR REPLACE FUNCTION public.finalize_quote_files(p_order_id uuid, p_files jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  file_item jsonb;
  file_count integer;
  file_position integer := 0;
  total_size bigint := 0;
  expected_prefix text;
  quote_row public.orders_3d%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_files) <> 'array' THEN
    RAISE EXCEPTION 'files must be an array' USING ERRCODE = '22023';
  END IF;

  file_count := jsonb_array_length(p_files);
  IF file_count < 1 OR file_count > 10 THEN
    RAISE EXCEPTION 'invalid file count' USING ERRCODE = '22023';
  END IF;

  expected_prefix := auth.uid()::text || '/' || p_order_id::text || '/';
  FOR file_item IN SELECT value FROM jsonb_array_elements(p_files)
  LOOP
    IF file_item->>'bucket' <> 'quote-files'
      OR file_item->>'storage_path' NOT LIKE expected_prefix || '%'
      OR lower(file_item->>'type') NOT IN ('stl', 'step', 'stp', 'obj', '3mf')
      OR COALESCE((file_item->>'size')::bigint, 0) < 1
      OR COALESCE((file_item->>'size')::bigint, 0) > 52428800
    THEN
      RAISE EXCEPTION 'invalid file metadata' USING ERRCODE = '22023';
    END IF;
    total_size := total_size + (file_item->>'size')::bigint;
  END LOOP;

  IF total_size > 209715200 THEN
    RAISE EXCEPTION 'total file size exceeded' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders_3d
  SET
    files = p_files,
    slicing_status = 'pending',
    slicing_result = NULL,
    sliced_at = NULL,
    updated_at = now()
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'new'
    AND COALESCE(jsonb_array_length(files), 0) = 0
  RETURNING * INTO quote_row;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  FOR file_item IN SELECT value FROM jsonb_array_elements(p_files)
  LOOP
    INSERT INTO public.slicing_jobs (
      order_id,
      user_id,
      file_index,
      input_file,
      material_name,
      color,
      infill_percent
    )
    VALUES (
      quote_row.id,
      quote_row.user_id,
      file_position,
      file_item,
      quote_row.material_name,
      quote_row.color,
      quote_row.infill_percent
    )
    ON CONFLICT (order_id, file_index) DO NOTHING;

    file_position := file_position + 1;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_slicing_job(
  p_worker_id text,
  p_printer_profile text DEFAULT NULL,
  p_process_profile text DEFAULT NULL
)
RETURNS SETOF public.slicing_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_id uuid;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(COALESCE(p_worker_id, ''))) < 1 OR length(p_worker_id) > 120 THEN
    RAISE EXCEPTION 'invalid worker id' USING ERRCODE = '22023';
  END IF;

  UPDATE public.slicing_jobs
  SET
    status = CASE WHEN attempt_count >= 3 THEN 'failed' ELSE 'pending' END,
    worker_id = NULL,
    completed_at = CASE WHEN attempt_count >= 3 THEN now() ELSE NULL END,
    error_message = CASE
      WHEN attempt_count >= 3 THEN 'Worker nie zakończył zadania w wymaganym czasie.'
      ELSE NULL
    END,
    updated_at = now()
  WHERE status = 'processing'
    AND started_at < now() - interval '20 minutes';

  UPDATE public.orders_3d AS order_row
  SET
    slicing_status = CASE
      WHEN EXISTS (
        SELECT 1 FROM public.slicing_jobs AS completed_job
        WHERE completed_job.order_id = order_row.id
          AND completed_job.status = 'completed'
      ) THEN 'partial_failed'
      ELSE 'failed'
    END,
    sliced_at = now(),
    updated_at = now()
  WHERE order_row.slicing_status = 'processing'
    AND EXISTS (
      SELECT 1 FROM public.slicing_jobs AS failed_job
      WHERE failed_job.order_id = order_row.id
        AND failed_job.status = 'failed'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.slicing_jobs AS active_job
      WHERE active_job.order_id = order_row.id
        AND active_job.status IN ('pending', 'processing')
    );

  SELECT id INTO claimed_id
  FROM public.slicing_jobs
  WHERE status = 'pending'
    AND attempt_count < 3
  ORDER BY requested_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF claimed_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.slicing_jobs
  SET
    status = 'processing',
    attempt_count = attempt_count + 1,
    worker_id = trim(p_worker_id),
    printer_profile = NULLIF(trim(COALESCE(p_printer_profile, '')), ''),
    process_profile = NULLIF(trim(COALESCE(p_process_profile, '')), ''),
    started_at = now(),
    completed_at = NULL,
    error_message = NULL,
    updated_at = now()
  WHERE id = claimed_id
  RETURNING *;

  UPDATE public.orders_3d
  SET slicing_status = 'processing', updated_at = now()
  WHERE id = (
    SELECT order_id FROM public.slicing_jobs WHERE id = claimed_id
  )
    AND slicing_status = 'pending';
END;
$$;

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

  UPDATE public.orders_3d
  SET
    slicing_status = CASE
      WHEN pending_count > 0 THEN 'processing'
      WHEN failed_count = 0 THEN 'completed'
      WHEN completed_count > 0 THEN 'partial_failed'
      ELSE 'failed'
    END,
    printing_time_hours = CASE
      WHEN completed_count > 0 THEN round((total_seconds / 3600.0) * quantity, 2)
      ELSE NULL
    END,
    filament_used_grams = CASE
      WHEN completed_count > 0 THEN round(total_grams * quantity, 2)
      ELSE NULL
    END,
    slicer_name = NULLIF(trim(COALESCE(p_slicer_name, '')), ''),
    slicer_version = NULLIF(trim(COALESCE(p_slicer_version, '')), ''),
    slicing_result = aggregated_result,
    sliced_at = CASE WHEN pending_count = 0 THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = target_order_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_slicing_job(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_slicing_job(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_slicing_job(uuid, text, jsonb, text, text, text) TO service_role;
