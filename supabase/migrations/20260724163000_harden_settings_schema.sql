-- Complete and seed the settings used by checkout, quotes and the admin panel.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text,
  label text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS key text,
  ADD COLUMN IF NOT EXISTS value text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.settings
SET
  key = COALESCE(NULLIF(trim(key), ''), 'legacy_' || left(id::text, 8)),
  category = COALESCE(NULLIF(trim(category), ''), 'general'),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.settings
  ALTER COLUMN key SET NOT NULL,
  ALTER COLUMN category SET DEFAULT 'general',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

-- Keep the newest row when an older database contains duplicate setting keys.
DELETE FROM public.settings older
USING public.settings newer
WHERE older.key = newer.key
  AND (
    older.updated_at < newer.updated_at OR
    (older.updated_at = newer.updated_at AND older.id::text < newer.id::text)
  );

CREATE UNIQUE INDEX IF NOT EXISTS settings_key_unique_idx
  ON public.settings (key);
CREATE INDEX IF NOT EXISTS settings_category_key_idx
  ON public.settings (category, key);

INSERT INTO public.settings (key, value, label, category)
VALUES
  ('company_name', 'KORIX3D', 'Nazwa firmy', 'general'),
  ('company_slogan', 'Tworzymy przyszłość warstwa po warstwie', 'Slogan', 'general'),
  ('company_email', 'kontakt@korix3d.pl', 'E-mail kontaktowy', 'general'),
  ('company_phone', '', 'Telefon', 'general'),
  ('company_address', '', 'Adres', 'general'),
  ('printing_hour_cost', '50', 'Koszt godziny druku', 'pricing'),
  ('electricity_hour_cost', '2', 'Koszt energii na godzinę', 'pricing'),
  ('maintenance_hour_cost', '5', 'Koszt utrzymania maszyny na godzinę', 'pricing'),
  ('packaging_cost', '5', 'Koszt opakowania', 'pricing'),
  ('default_margin', '25', 'Domyślna marża', 'pricing'),
  ('vat_rate', '23', 'Stawka VAT', 'pricing'),
  ('minimum_order_value', '20', 'Minimalna wartość zamówienia', 'pricing'),
  ('free_shipping_threshold', '200', 'Próg darmowej dostawy', 'shipping'),
  ('pickup_price', '0', 'Odbiór osobisty', 'shipping'),
  ('courier_price', '15', 'Kurier', 'shipping'),
  ('paczkomat_price', '12', 'Paczkomat', 'shipping'),
  ('social_facebook', '', 'Facebook', 'social'),
  ('social_instagram', '', 'Instagram', 'social'),
  ('social_linkedin', '', 'LinkedIn', 'social'),
  ('seo_title', 'KORIX3D — profesjonalny druk 3D', 'Tytuł SEO', 'seo'),
  ('seo_description', 'Druk 3D, prototypowanie i produkcja krótkoseryjna.', 'Opis SEO', 'seo')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS settings_set_updated_at ON public.settings;
CREATE TRIGGER settings_set_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.set_settings_updated_at();

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_public_read ON public.settings;
DROP POLICY IF EXISTS settings_admin_write ON public.settings;

CREATE POLICY settings_public_read ON public.settings
  FOR SELECT TO anon, authenticated
  USING (
    category IN ('general', 'pricing', 'shipping', 'social', 'seo')
    OR public.is_admin()
  );

CREATE POLICY settings_admin_write ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
