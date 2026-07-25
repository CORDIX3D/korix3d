-- PostgREST requests made with the service role do not expose auth.uid().
-- Trusted server endpoints pass the already authenticated actor in a private
-- request header so audit history can retain who performed the change.

CREATE OR REPLACE FUNCTION public.capture_admin_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_id text;
  actor_id uuid := auth.uid();
  request_headers jsonb;
  actor_header text;
BEGIN
  IF actor_id IS NULL AND auth.role() = 'service_role' THEN
    BEGIN
      request_headers := NULLIF(
        current_setting('request.headers', true),
        ''
      )::jsonb;
      actor_header := request_headers->>'x-korix-actor-id';

      IF actor_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        actor_id := actor_header::uuid;
      END IF;
    EXCEPTION
      WHEN invalid_text_representation OR invalid_parameter_value THEN
        actor_id := NULL;
    END;
  END IF;

  row_id := COALESCE(
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)->>'id' ELSE to_jsonb(NEW)->>'id' END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)->>'key' ELSE to_jsonb(NEW)->>'key' END
  );

  INSERT INTO public.admin_audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by
  ) VALUES (
    TG_TABLE_NAME,
    row_id,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    actor_id
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_admin_audit_change() FROM PUBLIC;
