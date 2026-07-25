-- Ensure the customer wishlist exists and cannot contain duplicates or
-- records that belong to another authenticated account.

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wishlist_items
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN user_id SET DEFAULT auth.uid(),
  ALTER COLUMN created_at SET DEFAULT now();

DELETE FROM public.wishlist_items AS item
WHERE item.user_id IS NULL
  OR item.product_id IS NULL
  OR NOT EXISTS (SELECT 1 FROM auth.users AS account WHERE account.id = item.user_id)
  OR NOT EXISTS (SELECT 1 FROM public.products AS product WHERE product.id = item.product_id);

UPDATE public.wishlist_items
SET created_at = now()
WHERE created_at IS NULL;

DELETE FROM public.wishlist_items AS older
USING public.wishlist_items AS newer
WHERE older.user_id = newer.user_id
  AND older.product_id = newer.product_id
  AND (
    older.created_at < newer.created_at
    OR (older.created_at = newer.created_at AND older.id::text < newer.id::text)
  );

ALTER TABLE public.wishlist_items
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wishlist_items'::regclass
      AND conname = 'wishlist_items_user_id_fkey'
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.wishlist_items'::regclass
      AND conname = 'wishlist_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.wishlist_items
      ADD CONSTRAINT wishlist_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS wishlist_items_user_product_unique
  ON public.wishlist_items (user_id, product_id);

CREATE INDEX IF NOT EXISTS wishlist_items_product_id_idx
  ON public.wishlist_items (product_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishlist_items_user_read ON public.wishlist_items;
CREATE POLICY wishlist_items_user_read ON public.wishlist_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS wishlist_items_user_write ON public.wishlist_items;
CREATE POLICY wishlist_items_user_write ON public.wishlist_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.wishlist_items FROM anon;
GRANT SELECT, INSERT, DELETE ON public.wishlist_items TO authenticated;
