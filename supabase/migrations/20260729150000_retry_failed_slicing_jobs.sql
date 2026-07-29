-- Keep a bounded failure history and retry transient Creality Print failures.

ALTER TABLE public.slicing_jobs
  ADD COLUMN IF NOT EXISTS failure_history jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'slicing_jobs_failure_history_array_check'
  ) THEN
    ALTER TABLE public.slicing_jobs
      ADD CONSTRAINT slicing_jobs_failure_history_array_check
      CHECK (jsonb_typeof(failure_history) = 'array') NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_slicing_job_failure()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'processing'
     AND NEW.status IN ('pending', 'failed')
     AND NULLIF(trim(COALESCE(NEW.error_message, '')), '') IS NOT NULL THEN
    NEW.failure_history := COALESCE(OLD.failure_history, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object(
        'attempt', OLD.attempt_count,
        'worker_id', OLD.worker_id,
        'message', left(trim(NEW.error_message), 1000),
        'failed_at', now()
      ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS slicing_jobs_record_failure ON public.slicing_jobs;
CREATE TRIGGER slicing_jobs_record_failure
  BEFORE UPDATE ON public.slicing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.record_slicing_job_failure();

CREATE OR REPLACE FUNCTION public.fail_or_retry_slicing_job(
  p_job_id uuid,
  p_error_message text DEFAULT NULL,
  p_slicer_name text DEFAULT 'Creality Print',
  p_slicer_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  job_row public.slicing_jobs%ROWTYPE;
  retry_error text := left(
    COALESCE(NULLIF(trim(p_error_message), ''), 'Creality Print nie ukończył analizy pliku.'),
    1000
  );
  finalized boolean;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO job_row
  FROM public.slicing_jobs
  WHERE id = p_job_id
    AND status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('accepted', false, 'retrying', false);
  END IF;

  IF job_row.attempt_count < 3 THEN
    UPDATE public.slicing_jobs
    SET
      status = 'pending',
      worker_id = NULL,
      printer_profile = NULL,
      process_profile = NULL,
      slicer_name = NULLIF(trim(COALESCE(p_slicer_name, '')), ''),
      slicer_version = NULLIF(trim(COALESCE(p_slicer_version, '')), ''),
      result = NULL,
      error_message = retry_error,
      requested_at = now(),
      started_at = NULL,
      completed_at = NULL,
      updated_at = now()
    WHERE id = p_job_id;

    UPDATE public.orders_3d AS order_row
    SET slicing_status = 'pending', updated_at = now()
    WHERE order_row.id = job_row.order_id
      AND NOT EXISTS (
        SELECT 1 FROM public.slicing_jobs AS active_job
        WHERE active_job.order_id = order_row.id
          AND active_job.status = 'processing'
      );

    RETURN jsonb_build_object(
      'accepted', true,
      'retrying', true,
      'attempt_count', job_row.attempt_count
    );
  END IF;

  finalized := public.finish_slicing_job(
    p_job_id,
    'failed',
    NULL,
    retry_error,
    p_slicer_name,
    p_slicer_version
  );

  RETURN jsonb_build_object(
    'accepted', finalized,
    'retrying', false,
    'attempt_count', job_row.attempt_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_slicing_job_failure() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_or_retry_slicing_job(uuid, text, text, text)
FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_or_retry_slicing_job(uuid, text, text, text)
TO service_role;
