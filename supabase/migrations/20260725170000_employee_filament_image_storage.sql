-- Employees manage operational filament stock, so they also need narrowly
-- scoped access to images stored under product-images/filaments.

DROP POLICY IF EXISTS product_images_filament_staff_insert ON storage.objects;
CREATE POLICY product_images_filament_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'filaments'
    AND public.is_employee()
  );

DROP POLICY IF EXISTS product_images_filament_staff_update ON storage.objects;
CREATE POLICY product_images_filament_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'filaments'
    AND public.is_employee()
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'filaments'
    AND public.is_employee()
  );

DROP POLICY IF EXISTS product_images_filament_staff_delete ON storage.objects;
CREATE POLICY product_images_filament_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'filaments'
    AND public.is_employee()
  );
