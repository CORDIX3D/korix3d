-- Customer-owned rows remain readable to their owners, but security-sensitive
-- records must only be created through validated server endpoints.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
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
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'employee')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'customer'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_employee() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_employee() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_insert_admin ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY profiles_insert_admin ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS orders_3d_insert_own ON public.orders_3d;
DROP POLICY IF EXISTS "orders_3d_insert_own" ON public.orders_3d;
DROP POLICY IF EXISTS orders_3d_insert_admin ON public.orders_3d;
CREATE POLICY orders_3d_insert_admin ON public.orders_3d
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS store_orders_user_insert ON public.store_orders;
DROP POLICY IF EXISTS "store_orders_user_insert" ON public.store_orders;
DROP POLICY IF EXISTS store_orders_admin_insert ON public.store_orders;
CREATE POLICY store_orders_admin_insert ON public.store_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DO $$
BEGIN
  IF to_regclass('public.product_reviews') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "product_reviews_user_insert" ON public.product_reviews';
    EXECUTE 'CREATE POLICY product_reviews_user_insert ON public.product_reviews
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id AND COALESCE(approved, false) = false)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_notification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF
    auth.uid() IS NOT NULL
    AND auth.uid() = OLD.user_id
    AND NOT public.is_admin()
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.message IS DISTINCT FROM OLD.message
      OR NEW.type IS DISTINCT FROM OLD.type
      OR NEW.link IS DISTINCT FROM OLD.link
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    )
  THEN
    RAISE EXCEPTION 'only notification read state may be changed by its recipient'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_notification_fields() FROM PUBLIC;

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS notifications_protect_fields ON public.notifications';
    EXECUTE 'CREATE TRIGGER notifications_protect_fields
      BEFORE UPDATE ON public.notifications
      FOR EACH ROW EXECUTE FUNCTION public.protect_notification_fields()';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.ai_messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "insert_own_messages" ON public.ai_messages';
    EXECUTE 'CREATE POLICY insert_own_messages ON public.ai_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        role = ''user''
        AND EXISTS (
          SELECT 1
          FROM public.ai_conversations
          WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
      )';
  END IF;
END $$;
