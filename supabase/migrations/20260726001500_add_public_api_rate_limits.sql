-- Persistent, privacy-preserving limits for free public endpoints. The app sends
-- only a salted SHA-256 fingerprint; raw client addresses are never stored.

DELETE FROM public.ai_logs
WHERE user_id IS NULL;

DELETE FROM public.ai_file_uploads
WHERE user_id IS NULL;

DELETE FROM public.ai_conversations
WHERE user_id IS NULL;

ALTER TABLE public.ai_conversations
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.ai_file_uploads
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.ai_logs
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.ai_file_uploads
  DROP CONSTRAINT IF EXISTS ai_file_uploads_user_id_fkey,
  ADD CONSTRAINT ai_file_uploads_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.ai_logs
  DROP CONSTRAINT IF EXISTS ai_logs_user_id_fkey,
  ADD CONSTRAINT ai_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.public_api_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash),
  CONSTRAINT public_api_rate_limits_scope_check
    CHECK (scope ~ '^[a-z0-9_-]{1,64}$'),
  CONSTRAINT public_api_rate_limits_key_hash_check
    CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT public_api_rate_limits_request_count_check
    CHECK (request_count BETWEEN 0 AND 1000000)
);

CREATE INDEX IF NOT EXISTS public_api_rate_limits_last_seen_idx
  ON public.public_api_rate_limits (last_seen_at);

ALTER TABLE public.public_api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_public_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  allowed boolean;
BEGIN
  IF current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;

  IF p_scope !~ '^[a-z0-9_-]{1,64}$'
    OR p_key_hash !~ '^[a-f0-9]{64}$'
    OR p_limit NOT BETWEEN 1 AND 1000
    OR p_window_seconds NOT BETWEEN 10 AND 86400
  THEN
    RAISE EXCEPTION 'invalid rate limit parameters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.public_api_rate_limits (
    scope,
    key_hash,
    window_started_at,
    request_count,
    last_seen_at
  )
  VALUES (p_scope, p_key_hash, now(), 1, now())
  ON CONFLICT (scope, key_hash) DO UPDATE
  SET
    window_started_at = CASE
      WHEN public.public_api_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN now()
      ELSE public.public_api_rate_limits.window_started_at
    END,
    request_count = CASE
      WHEN public.public_api_rate_limits.window_started_at
        <= now() - make_interval(secs => p_window_seconds)
      THEN 1
      ELSE LEAST(public.public_api_rate_limits.request_count + 1, 1000000)
    END,
    last_seen_at = now()
  RETURNING request_count <= p_limit INTO allowed;

  IF random() < 0.01 THEN
    DELETE FROM public.public_api_rate_limits
    WHERE last_seen_at < now() - interval '7 days';
  END IF;

  RETURN allowed;
END;
$$;

REVOKE ALL ON TABLE public.public_api_rate_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_public_api_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_public_api_rate_limit(text, text, integer, integer) TO service_role;
