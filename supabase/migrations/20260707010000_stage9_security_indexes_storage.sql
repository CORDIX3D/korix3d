-- KORIX3D Stage 9: security hardening, query indexes and storage.
-- This migration is idempotent and assumes the base KORIX3D schema is present.

-- Role helpers must not depend on a caller-controlled search_path.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_employee()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'employee')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_employee() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_employee() TO authenticated;

-- Dedicated newsletter storage; public users can subscribe but cannot enumerate addresses.
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'footer',
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  CONSTRAINT newsletter_email_normalized CHECK (email = lower(trim(email))),
  CONSTRAINT newsletter_email_length CHECK (char_length(email) BETWEEN 3 AND 320)
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_unique
  ON public.newsletter_subscribers (lower(email));

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS newsletter_public_insert ON public.newsletter_subscribers;
CREATE POLICY newsletter_public_insert ON public.newsletter_subscribers
  FOR INSERT TO anon, authenticated
  WITH CHECK (active = true AND source = 'footer');
DROP POLICY IF EXISTS newsletter_admin_all ON public.newsletter_subscribers;
CREATE POLICY newsletter_admin_all ON public.newsletter_subscribers
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- A customer may accept only their own already quoted order. Direct customer UPDATE
-- remains forbidden, preventing price, ownership or production data tampering.
CREATE OR REPLACE FUNCTION public.accept_order_quote(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed_rows integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders_3d
  SET status = 'accepted', updated_at = now()
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'quoted';

  GET DIAGNOSTICS changed_rows = ROW_COUNT;
  RETURN changed_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_order_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_order_quote(uuid) TO authenticated;

-- Indexes matching filters and sort orders used by the application.
CREATE INDEX IF NOT EXISTS orders_3d_user_created_idx ON public.orders_3d (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_3d_status_created_idx ON public.orders_3d (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_3d_material_idx ON public.orders_3d (material_id) WHERE material_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_active_category_idx ON public.products (active, category_id);
CREATE INDEX IF NOT EXISTS products_created_idx ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS categories_active_name_idx ON public.categories (active, name);
CREATE INDEX IF NOT EXISTS materials_available_name_idx ON public.materials (available, name);
CREATE INDEX IF NOT EXISTS material_colors_material_available_idx ON public.material_colors (material_id, available);
CREATE INDEX IF NOT EXISTS filaments_active_created_idx ON public.filaments (active, created_at DESC);
CREATE INDEX IF NOT EXISTS blog_posts_public_idx ON public.blog_posts (published, published_at DESC);
CREATE INDEX IF NOT EXISTS faq_items_public_idx ON public.faq_items (active, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_items_public_idx ON public.portfolio_items (active, sort_order);
CREATE INDEX IF NOT EXISTS contact_submissions_created_idx ON public.contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS store_orders_user_created_idx ON public.store_orders (user_id, created_at DESC);

-- Add core foreign keys without failing on historical orphan rows. NOT VALID still
-- protects all new writes; validation can follow after legacy data cleanup.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_user_id_fkey') THEN
    ALTER TABLE public.orders_3d ADD CONSTRAINT orders_3d_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_3d_material_id_fkey') THEN
    ALTER TABLE public.orders_3d ADD CONSTRAINT orders_3d_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'material_colors_material_id_fkey') THEN
    ALTER TABLE public.material_colors ADD CONSTRAINT material_colors_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'filaments_material_id_fkey') THEN
    ALTER TABLE public.filaments ADD CONSTRAINT filaments_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

-- Ensure RLS cannot accidentally be bypassed on the tables reached from browsers.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Customers keep read/insert access to orders, while staff retain management access.
DROP POLICY IF EXISTS orders_3d_select_own ON public.orders_3d;
CREATE POLICY orders_3d_select_own ON public.orders_3d
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_employee());
DROP POLICY IF EXISTS orders_3d_insert_own ON public.orders_3d;
CREATE POLICY orders_3d_insert_own ON public.orders_3d
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS orders_3d_update_staff ON public.orders_3d;
CREATE POLICY orders_3d_update_staff ON public.orders_3d
  FOR UPDATE TO authenticated
  USING (public.is_employee()) WITH CHECK (public.is_employee());

-- Only non-sensitive site configuration is publicly readable.
DROP POLICY IF EXISTS settings_public_read ON public.settings;
CREATE POLICY settings_public_read ON public.settings
  FOR SELECT TO anon, authenticated
  USING (category IN ('general', 'pricing', 'shipping', 'social', 'seo') OR public.is_admin());

-- Private quote models. Stage 10 stores files under <user-id>/<order-id>/filename.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-files', 'quote-files', false, 52428800,
  ARRAY['application/octet-stream', 'application/vnd.ms-pki.stl', 'model/stl', 'model/obj', 'model/3mf', 'application/step']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS quote_files_owner_insert ON storage.objects;
CREATE POLICY quote_files_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quote-files' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS quote_files_owner_select ON storage.objects;
CREATE POLICY quote_files_owner_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quote-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_employee()));
DROP POLICY IF EXISTS quote_files_owner_delete ON storage.objects;
CREATE POLICY quote_files_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quote-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
