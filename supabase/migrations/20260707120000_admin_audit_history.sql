-- Administrator change history for business and content modules.
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_changed_at_idx
  ON public.admin_audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_table_changed_idx
  ON public.admin_audit_log (table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log (changed_by, changed_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_audit_log_staff_read ON public.admin_audit_log;
CREATE POLICY admin_audit_log_staff_read ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (public.is_employee());

CREATE OR REPLACE FUNCTION public.capture_admin_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  row_id text;
BEGIN
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
    auth.uid()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.capture_admin_audit_change() FROM PUBLIC;

DO $$
DECLARE
  audited_table text;
  audited_tables text[] := ARRAY[
    'warehouse_items', 'filaments', 'materials', 'material_colors',
    'products', 'categories', 'orders_3d', 'store_orders', 'settings',
    'blog_posts', 'faq_items', 'portfolio_items', 'discount_codes',
    'profiles', 'contact_submissions', 'notifications'
  ];
BEGIN
  FOREACH audited_table IN ARRAY audited_tables LOOP
    IF to_regclass(format('public.%I', audited_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS admin_audit_change ON public.%I', audited_table);
      EXECUTE format(
        'CREATE TRIGGER admin_audit_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_admin_audit_change()',
        audited_table
      );
    END IF;
  END LOOP;
END $$;

