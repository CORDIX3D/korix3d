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

  UPDATE public.slicing_jobs AS job
  SET
    status = 'cancelled',
    worker_id = NULL,
    completed_at = now(),
    error_message = 'Zadanie pominięte, ponieważ zlecenie zostało anulowane.',
    updated_at = now()
  FROM public.orders_3d AS order_row
  WHERE order_row.id = job.order_id
    AND order_row.status = 'cancelled'
    AND job.status IN ('pending', 'processing');

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

  SELECT job.id INTO claimed_id
  FROM public.slicing_jobs AS job
  INNER JOIN public.orders_3d AS order_row ON order_row.id = job.order_id
  WHERE job.status = 'pending'
    AND job.attempt_count < 3
    AND order_row.status <> 'cancelled'
  ORDER BY job.requested_at, job.created_at
  FOR UPDATE OF job SKIP LOCKED
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

REVOKE ALL ON FUNCTION public.claim_slicing_job(text, text, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_slicing_job(text, text, text)
TO service_role;
