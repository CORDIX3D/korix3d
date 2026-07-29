-- Persist Stripe event identifiers so webhook retries are safe and observable.
-- No event payload is stored because it can contain customer data.

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  object_id text,
  order_id uuid REFERENCES public.store_orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processing',
  attempts integer NOT NULL DEFAULT 1,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_webhook_events_event_id_check
    CHECK (length(event_id) BETWEEN 3 AND 255),
  CONSTRAINT stripe_webhook_events_event_type_check
    CHECK (length(event_type) BETWEEN 3 AND 160),
  CONSTRAINT stripe_webhook_events_status_check
    CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  CONSTRAINT stripe_webhook_events_attempts_check
    CHECK (attempts BETWEEN 1 AND 1000)
);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_order_id_idx
  ON public.stripe_webhook_events (order_id, received_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS stripe_webhook_events_status_idx
  ON public.stripe_webhook_events (status, updated_at DESC);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_object_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed boolean;
BEGIN
  IF p_event_id IS NULL OR length(p_event_id) NOT BETWEEN 3 AND 255
     OR p_event_type IS NULL OR length(p_event_type) NOT BETWEEN 3 AND 160
     OR (p_object_id IS NOT NULL AND length(p_object_id) > 255) THEN
    RAISE EXCEPTION 'invalid Stripe event identity' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.stripe_webhook_events (
    event_id,
    event_type,
    object_id,
    status,
    attempts,
    received_at,
    processing_started_at,
    updated_at
  )
  VALUES (
    p_event_id,
    p_event_type,
    p_object_id,
    'processing',
    1,
    now(),
    now(),
    now()
  )
  ON CONFLICT (event_id) DO UPDATE
  SET
    status = 'processing',
    attempts = public.stripe_webhook_events.attempts + 1,
    last_error = NULL,
    processing_started_at = now(),
    updated_at = now()
  WHERE public.stripe_webhook_events.status = 'failed'
     OR (
       public.stripe_webhook_events.status = 'processing'
       AND public.stripe_webhook_events.processing_started_at < now() - interval '10 minutes'
     )
  RETURNING true INTO claimed;

  RETURN COALESCE(claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_stripe_webhook_event(
  p_event_id text,
  p_status text,
  p_order_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_status NOT IN ('processed', 'ignored') THEN
    RAISE EXCEPTION 'invalid Stripe event result' USING ERRCODE = '22023';
  END IF;

  UPDATE public.stripe_webhook_events
  SET
    status = p_status,
    order_id = p_order_id,
    last_error = NULL,
    processed_at = now(),
    updated_at = now()
  WHERE event_id = p_event_id
    AND status = 'processing';

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_stripe_webhook_event(
  p_event_id text,
  p_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.stripe_webhook_events
  SET
    status = 'failed',
    last_error = left(COALESCE(NULLIF(trim(p_error), ''), 'processing_failed'), 500),
    processed_at = NULL,
    updated_at = now()
  WHERE event_id = p_event_id
    AND status = 'processing';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_webhook_event(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_stripe_webhook_event(text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_stripe_webhook_event(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_stripe_webhook_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_webhook_event(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_stripe_webhook_event(text, text) TO service_role;
