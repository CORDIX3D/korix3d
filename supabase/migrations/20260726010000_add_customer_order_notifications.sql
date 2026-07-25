-- Turn the existing notifications module into a reliable customer order feed.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info',
  read boolean DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DELETE FROM public.notifications WHERE user_id IS NULL;

UPDATE public.notifications
SET
  title = COALESCE(NULLIF(trim(title), ''), 'Powiadomienie'),
  message = COALESCE(NULLIF(trim(message), ''), 'Status został zaktualizowany.'),
  type = CASE WHEN type IN ('info', 'success', 'warning', 'error') THEN type ELSE 'info' END,
  read = COALESCE(read, false),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.notifications
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN message SET NOT NULL,
  ALTER COLUMN type SET DEFAULT 'info',
  ALTER COLUMN read SET DEFAULT false,
  ALTER COLUMN read SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_user_id_fkey'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_type_check'
      AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN ('info', 'success', 'warning', 'error')) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read IS FALSE;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_user_read ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_read" ON public.notifications;
DROP POLICY IF EXISTS notifications_user_update ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_update" ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_insert ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin_insert" ON public.notifications;
DROP POLICY IF EXISTS notifications_admin_all ON public.notifications;

CREATE POLICY notifications_user_read ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notifications_user_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

CREATE OR REPLACE FUNCTION public.protect_notification_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
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

DROP TRIGGER IF EXISTS notifications_protect_fields ON public.notifications;
CREATE TRIGGER notifications_protect_fields
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_fields();

CREATE OR REPLACE FUNCTION public.notify_store_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notification_title text;
  notification_message text;
  notification_type text := 'info';
BEGIN
  IF NEW.user_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'paid' THEN
      notification_title := 'Płatność potwierdzona';
      notification_message := 'Zamówienie ' || NEW.order_number || ' zostało opłacone.';
      notification_type := 'success';
    WHEN 'processing' THEN
      notification_title := 'Zamówienie w realizacji';
      notification_message := 'Rozpoczęliśmy realizację zamówienia ' || NEW.order_number || '.';
    WHEN 'shipped' THEN
      notification_title := 'Zamówienie wysłane';
      notification_message := 'Zamówienie ' || NEW.order_number || ' zostało przekazane do dostawy.';
      notification_type := 'success';
    WHEN 'delivered' THEN
      notification_title := 'Zamówienie dostarczone';
      notification_message := 'Zamówienie ' || NEW.order_number || ' oznaczono jako dostarczone.';
      notification_type := 'success';
    WHEN 'cancelled' THEN
      notification_title := 'Zamówienie anulowane';
      notification_message := 'Zamówienie ' || NEW.order_number || ' zostało anulowane.';
      notification_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.user_id,
    notification_title,
    notification_message,
    notification_type,
    '/panel/zamowienia/sklep/' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS store_orders_notify_status ON public.store_orders;
CREATE TRIGGER store_orders_notify_status
  AFTER UPDATE OF status ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_store_order_status();

CREATE OR REPLACE FUNCTION public.notify_order_3d_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  notification_title text;
  notification_message text;
  notification_type text := 'info';
BEGIN
  IF NEW.user_id IS NULL OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'quoted' THEN
      notification_title := 'Wycena jest gotowa';
      notification_message := 'Gotowa wycena zlecenia ' || NEW.order_number || ' czeka na Twoją decyzję.';
      notification_type := 'success';
    WHEN 'accepted' THEN
      notification_title := 'Wycena zaakceptowana';
      notification_message := 'Zaakceptowano wycenę zlecenia ' || NEW.order_number || '.';
      notification_type := 'success';
    WHEN 'queued' THEN
      notification_title := 'Zlecenie w kolejce';
      notification_message := 'Zlecenie ' || NEW.order_number || ' trafiło do kolejki produkcyjnej.';
    WHEN 'printing' THEN
      notification_title := 'Rozpoczęto druk';
      notification_message := 'Trwa drukowanie zlecenia ' || NEW.order_number || '.';
    WHEN 'post_processing' THEN
      notification_title := 'Obróbka wydruku';
      notification_message := 'Zlecenie ' || NEW.order_number || ' jest przygotowywane po wydruku.';
    WHEN 'packed' THEN
      notification_title := 'Zlecenie spakowane';
      notification_message := 'Zlecenie ' || NEW.order_number || ' jest gotowe do wysyłki.';
    WHEN 'shipped' THEN
      notification_title := 'Zlecenie wysłane';
      notification_message := 'Zlecenie ' || NEW.order_number || ' zostało przekazane do dostawy.';
      notification_type := 'success';
    WHEN 'completed' THEN
      notification_title := 'Zlecenie zakończone';
      notification_message := 'Realizacja zlecenia ' || NEW.order_number || ' została zakończona.';
      notification_type := 'success';
    WHEN 'cancelled' THEN
      notification_title := 'Zlecenie anulowane';
      notification_message := 'Zlecenie ' || NEW.order_number || ' zostało anulowane.';
      notification_type := 'warning';
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    NEW.user_id,
    notification_title,
    notification_message,
    notification_type,
    '/panel/zamowienia/' || NEW.id::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_3d_notify_status ON public.orders_3d;
CREATE TRIGGER orders_3d_notify_status
  AFTER UPDATE OF status ON public.orders_3d
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_3d_status();

REVOKE ALL ON FUNCTION public.protect_notification_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_store_order_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_order_3d_status() FROM PUBLIC;
