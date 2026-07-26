-- Limit quote uploads at the storage boundary and keep finalized production
-- files immutable for the customer. Application validation remains the source
-- of friendly messages; these rules protect against direct Storage API calls.

CREATE OR REPLACE FUNCTION public.can_upload_quote_file(p_object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  folders text[];
  order_id uuid;
  expected_prefix text;
  object_count integer;
BEGIN
  IF current_user_id IS NULL OR p_object_name IS NULL OR length(p_object_name) > 500 THEN
    RETURN false;
  END IF;

  folders := storage.foldername(p_object_name);
  IF COALESCE(array_length(folders, 1), 0) <> 2
    OR folders[1] <> current_user_id::text
    OR lower(p_object_name) !~ '[.](stl|step|stp|obj|3mf)$'
  THEN
    RETURN false;
  END IF;

  BEGIN
    order_id := folders[2]::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN false;
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders_3d
    WHERE id = order_id
      AND user_id = current_user_id
      AND status = 'new'
      AND COALESCE(files, '[]'::jsonb) = '[]'::jsonb
  ) THEN
    RETURN false;
  END IF;

  expected_prefix := current_user_id::text || '/' || order_id::text || '/';
  PERFORM pg_advisory_xact_lock(hashtextextended(expected_prefix, 0));

  SELECT count(*) INTO object_count
  FROM storage.objects
  WHERE bucket_id = 'quote-files'
    AND name LIKE expected_prefix || '%';

  RETURN object_count < 10;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_order_3d_file_objects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  file_item jsonb;
  storage_path text;
  expected_prefix text;
  seen_paths text[] := ARRAY[]::text[];
BEGIN
  IF OLD.files IS NOT DISTINCT FROM NEW.files
    OR COALESCE(NEW.files, '[]'::jsonb) = '[]'::jsonb
  THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.files) <> 'array'
    OR jsonb_array_length(NEW.files) < 1
    OR jsonb_array_length(NEW.files) > 10
  THEN
    RAISE EXCEPTION 'invalid quote file list'
      USING ERRCODE = '23514';
  END IF;

  expected_prefix := NEW.user_id::text || '/' || NEW.id::text || '/';
  FOR file_item IN SELECT value FROM jsonb_array_elements(NEW.files)
  LOOP
    storage_path := file_item->>'storage_path';
    IF storage_path IS NULL
      OR storage_path NOT LIKE expected_prefix || '%'
      OR storage_path = ANY(seen_paths)
      OR NOT EXISTS (
        SELECT 1
        FROM storage.objects
        WHERE bucket_id = 'quote-files'
          AND name = storage_path
      )
    THEN
      RAISE EXCEPTION 'quote file object is missing or duplicated'
        USING ERRCODE = '23514';
    END IF;

    seen_paths := array_append(seen_paths, storage_path);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS quote_files_owner_insert ON storage.objects;
CREATE POLICY quote_files_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND public.can_upload_quote_file(name)
  );

DROP POLICY IF EXISTS quote_files_owner_delete ON storage.objects;
CREATE POLICY quote_files_owner_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-files'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = auth.uid()::text
        AND (
          NOT EXISTS (
            SELECT 1
            FROM public.orders_3d AS existing_order
            WHERE existing_order.id::text = (storage.foldername(name))[2]
          )
          OR EXISTS (
            SELECT 1
            FROM public.orders_3d AS order_row
            WHERE order_row.id::text = (storage.foldername(name))[2]
              AND order_row.user_id = auth.uid()
              AND order_row.status = 'new'
              AND COALESCE(order_row.files, '[]'::jsonb) = '[]'::jsonb
          )
        )
      )
    )
  );

DROP TRIGGER IF EXISTS orders_3d_00_validate_file_objects ON public.orders_3d;
CREATE TRIGGER orders_3d_00_validate_file_objects
  BEFORE UPDATE OF files ON public.orders_3d
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_3d_file_objects();

REVOKE ALL ON FUNCTION public.can_upload_quote_file(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_order_3d_file_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_upload_quote_file(text) TO authenticated;
