-- Stage 10 hardening: an upload must belong to an existing order and only a
-- validated RPC can attach uploaded objects to that order.

DROP POLICY IF EXISTS quote_files_owner_insert ON storage.objects;
CREATE POLICY quote_files_owner_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.orders_3d AS order_row
      WHERE order_row.id::text = (storage.foldername(name))[2]
        AND order_row.user_id = auth.uid()
        AND order_row.status = 'new'
        AND COALESCE(jsonb_array_length(order_row.files), 0) = 0
    )
  );

CREATE OR REPLACE FUNCTION public.finalize_quote_files(p_order_id uuid, p_files jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  file_item jsonb;
  file_count integer;
  total_size bigint := 0;
  expected_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(p_files) <> 'array' THEN
    RAISE EXCEPTION 'files must be an array' USING ERRCODE = '22023';
  END IF;

  file_count := jsonb_array_length(p_files);
  IF file_count < 1 OR file_count > 10 THEN
    RAISE EXCEPTION 'invalid file count' USING ERRCODE = '22023';
  END IF;

  expected_prefix := auth.uid()::text || '/' || p_order_id::text || '/';
  FOR file_item IN SELECT value FROM jsonb_array_elements(p_files)
  LOOP
    IF file_item->>'bucket' <> 'quote-files'
      OR file_item->>'storage_path' NOT LIKE expected_prefix || '%'
      OR lower(file_item->>'type') NOT IN ('stl', 'step', 'stp', 'obj', '3mf')
      OR COALESCE((file_item->>'size')::bigint, 0) < 1
      OR COALESCE((file_item->>'size')::bigint, 0) > 52428800
    THEN
      RAISE EXCEPTION 'invalid file metadata' USING ERRCODE = '22023';
    END IF;
    total_size := total_size + (file_item->>'size')::bigint;
  END LOOP;

  IF total_size > 209715200 THEN
    RAISE EXCEPTION 'total file size exceeded' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders_3d
  SET files = p_files, updated_at = now()
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'new'
    AND COALESCE(jsonb_array_length(files), 0) = 0;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.discard_incomplete_quote(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.orders_3d
  WHERE id = p_order_id
    AND user_id = auth.uid()
    AND status = 'new'
    AND final_price IS NULL
    AND COALESCE(jsonb_array_length(files), 0) = 0
    AND created_at > now() - interval '1 hour';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_quote_files(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.discard_incomplete_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_quote_files(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_incomplete_quote(uuid) TO authenticated;
