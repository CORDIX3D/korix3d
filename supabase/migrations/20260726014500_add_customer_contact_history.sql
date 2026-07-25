-- Link contact requests to signed-in customers and expose administrator replies
-- without opening direct public writes to the table.

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz;

UPDATE public.contact_submissions AS submission
SET user_id = profile.id
FROM public.profiles AS profile
WHERE submission.user_id IS NULL
  AND lower(submission.email) = lower(profile.email);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contact_submissions'::regclass
      AND conname = 'contact_submissions_user_id_fkey'
  ) THEN
    ALTER TABLE public.contact_submissions
      ADD CONSTRAINT contact_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS contact_submissions_user_created_idx
  ON public.contact_submissions (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_submissions_owner_read ON public.contact_submissions;
CREATE POLICY contact_submissions_owner_read ON public.contact_submissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.contact_submissions TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_contact_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN
    NEW.admin_reply := NULLIF(trim(NEW.admin_reply), '');
    NEW.replied := NEW.admin_reply IS NOT NULL;
    NEW.replied_at := CASE WHEN NEW.admin_reply IS NULL THEN NULL ELSE now() END;
    NEW.read := CASE WHEN NEW.admin_reply IS NULL THEN NEW.read ELSE true END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_normalize_reply ON public.contact_submissions;
CREATE TRIGGER contact_submissions_normalize_reply
  BEFORE UPDATE OF admin_reply ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_contact_reply();

CREATE OR REPLACE FUNCTION public.notify_contact_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL
    AND NEW.admin_reply IS NOT NULL
    AND OLD.admin_reply IS NULL
    AND NEW.admin_reply IS DISTINCT FROM OLD.admin_reply
  THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.user_id,
      'Odpowiedź na wiadomość',
      'Odpowiedzieliśmy na wiadomość „' || COALESCE(NULLIF(NEW.subject, ''), 'Bez tematu') || '”.',
      'success',
      '/panel/wiadomosci'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_submissions_notify_reply ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify_reply
  AFTER UPDATE OF admin_reply ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_reply();
