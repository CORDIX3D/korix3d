-- Ensure the public contact form has a complete, private destination table.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  replied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS replied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.contact_submissions
SET
  name = COALESCE(NULLIF(trim(name), ''), 'Nieznany nadawca'),
  email = lower(COALESCE(NULLIF(trim(email), ''), 'brak-adresu@invalid.local')),
  message = COALESCE(NULLIF(trim(message), ''), 'Brak treści wiadomości'),
  read = COALESCE(read, false),
  replied = COALESCE(replied, false),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.contact_submissions
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN email SET NOT NULL,
  ALTER COLUMN message SET NOT NULL,
  ALTER COLUMN read SET DEFAULT false,
  ALTER COLUMN read SET NOT NULL,
  ALTER COLUMN replied SET DEFAULT false,
  ALTER COLUMN replied SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS contact_submissions_unread_idx
  ON public.contact_submissions (read, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_submissions_email_idx
  ON public.contact_submissions (lower(email));

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_submissions_public_insert ON public.contact_submissions;
DROP POLICY IF EXISTS contact_submissions_admin_all ON public.contact_submissions;

CREATE POLICY contact_submissions_admin_all ON public.contact_submissions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.contact_submissions FROM anon, authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.contact_submissions TO authenticated;
