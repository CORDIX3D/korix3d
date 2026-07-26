-- Create legacy relations that were referenced by the original RLS migration
-- but were previously present only in dashboard-created databases.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.material_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex text NOT NULL DEFAULT '#FFFFFF',
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(12,2) NOT NULL DEFAULT 0,
  min_order_value numeric(12,2),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_order_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS max_uses integer,
  ADD COLUMN IF NOT EXISTS used_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.discount_codes
SET
  code = upper(COALESCE(NULLIF(trim(code), ''), 'LEGACY-' || left(id::text, 8))),
  discount_type = CASE
    WHEN discount_type IN ('percent', 'fixed') THEN discount_type
    ELSE 'percent'
  END,
  discount_value = GREATEST(COALESCE(discount_value, 0), 0),
  min_order_value = GREATEST(COALESCE(min_order_value, 0), 0),
  max_uses = CASE WHEN max_uses IS NULL THEN NULL ELSE GREATEST(max_uses, 0) END,
  used_count = GREATEST(COALESCE(used_count, 0), 0),
  active = COALESCE(active, true),
  created_at = COALESCE(created_at, now());

DELETE FROM public.discount_codes AS older
USING public.discount_codes AS newer
WHERE lower(older.code) = lower(newer.code)
  AND (
    older.created_at < newer.created_at
    OR (older.created_at = newer.created_at AND older.id::text < newer.id::text)
  );

ALTER TABLE public.discount_codes
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN discount_type SET DEFAULT 'percent',
  ALTER COLUMN discount_type SET NOT NULL,
  ALTER COLUMN discount_value SET DEFAULT 0,
  ALTER COLUMN discount_value SET NOT NULL,
  ALTER COLUMN used_count SET DEFAULT 0,
  ALTER COLUMN used_count SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  content text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders_3d(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_unique
  ON public.cart_items (user_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_unique
  ON public.discount_codes (lower(code));
CREATE INDEX IF NOT EXISTS material_colors_material_available_idx
  ON public.material_colors (material_id, available);

ALTER TABLE public.material_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS material_colors_public_read ON public.material_colors;
CREATE POLICY material_colors_public_read ON public.material_colors
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS material_colors_admin_write ON public.material_colors;
CREATE POLICY material_colors_admin_write ON public.material_colors
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cart_items_user_access ON public.cart_items;
CREATE POLICY cart_items_user_access ON public.cart_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS discount_codes_active_read ON public.discount_codes;
CREATE POLICY discount_codes_active_read ON public.discount_codes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (active AND (expires_at IS NULL OR expires_at > now()))
  );
DROP POLICY IF EXISTS discount_codes_admin_all ON public.discount_codes;
CREATE POLICY discount_codes_admin_all ON public.discount_codes
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS product_reviews_public_read ON public.product_reviews;
CREATE POLICY product_reviews_public_read ON public.product_reviews
  FOR SELECT TO anon, authenticated
  USING (approved OR user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS product_reviews_owner_insert ON public.product_reviews;
CREATE POLICY product_reviews_owner_insert ON public.product_reviews
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS product_reviews_admin_all ON public.product_reviews;
CREATE POLICY product_reviews_admin_all ON public.product_reviews
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS messages_participant_read ON public.messages;
CREATE POLICY messages_participant_read ON public.messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS messages_sender_insert ON public.messages;
CREATE POLICY messages_sender_insert ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS order_status_history_order_read ON public.order_status_history;
CREATE POLICY order_status_history_order_read ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders_3d AS order_row
      WHERE order_row.id = order_id
        AND (order_row.user_id = auth.uid() OR public.is_employee())
    )
  );
DROP POLICY IF EXISTS order_status_history_staff_all ON public.order_status_history;
CREATE POLICY order_status_history_staff_all ON public.order_status_history
  FOR ALL TO authenticated
  USING (public.is_employee()) WITH CHECK (public.is_employee());

REVOKE ALL ON public.material_colors, public.cart_items, public.discount_codes,
  public.product_reviews, public.messages, public.order_status_history
  FROM anon, authenticated;
GRANT SELECT ON public.material_colors, public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT SELECT, INSERT ON public.product_reviews, public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_colors,
  public.order_status_history TO authenticated;
GRANT ALL ON public.material_colors, public.cart_items, public.discount_codes,
  public.product_reviews, public.messages, public.order_status_history TO service_role;
