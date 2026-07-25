-- Public forms are written only through rate-limited server endpoints. This
-- prevents attackers from bypassing application limits through Supabase REST.

DROP POLICY IF EXISTS newsletter_public_insert ON public.newsletter_subscribers;
DROP POLICY IF EXISTS newsletter_subscribers_public_insert ON public.newsletter_subscribers;

REVOKE INSERT ON public.newsletter_subscribers FROM anon, authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;

DROP POLICY IF EXISTS contact_submissions_public_insert ON public.contact_submissions;
DROP POLICY IF EXISTS "contact_submissions_public_insert" ON public.contact_submissions;

REVOKE INSERT ON public.contact_submissions FROM anon, authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.contact_submissions TO authenticated;
