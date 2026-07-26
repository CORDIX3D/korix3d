-- Public pages may read presentation and shipping configuration, but company
-- pricing inputs are private and are consumed only by trusted server routes.

DROP POLICY IF EXISTS settings_public_read ON public.settings;

CREATE POLICY settings_public_read ON public.settings
  FOR SELECT TO anon, authenticated
  USING (
    category IN ('general', 'shipping', 'social', 'seo')
    OR public.is_admin()
  );

