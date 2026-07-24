-- Keep the store catalogue compatible with older KORIX3D databases.
-- This migration is additive and preserves existing data.

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  image_url text,
  parent_id uuid,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS parent_id uuid,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.categories
SET
  name = COALESCE(NULLIF(trim(name), ''), 'Kategoria'),
  slug = COALESCE(
    NULLIF(trim(slug), ''),
    NULLIF(regexp_replace(lower(COALESCE(name, '')), '[^a-z0-9]+', '-', 'g'), ''),
    'kategoria-' || left(id::text, 8)
  ),
  sort_order = COALESCE(sort_order, 0),
  active = COALESCE(active, true),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.categories
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS categories_slug_idx ON public.categories (slug);
CREATE INDEX IF NOT EXISTS categories_active_sort_idx ON public.categories (active, sort_order, name);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.categories(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  short_description text,
  category_id uuid,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_price numeric(12,2),
  cost_price numeric(12,2),
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_quantity integer NOT NULL DEFAULT 0,
  weight_grams integer,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  stripe_price_id text,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS category_id uuid,
  ADD COLUMN IF NOT EXISTS price numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compare_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_stock_quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weight_grams integer,
  ADD COLUMN IF NOT EXISTS dimensions jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.products
SET
  sku = COALESCE(NULLIF(trim(sku), ''), 'KORIX-' || upper(left(id::text, 8))),
  name = COALESCE(NULLIF(trim(name), ''), 'Produkt'),
  slug = COALESCE(
    NULLIF(trim(slug), ''),
    NULLIF(regexp_replace(lower(COALESCE(name, '')), '[^a-z0-9]+', '-', 'g'), ''),
    'produkt-' || left(id::text, 8)
  ),
  price = GREATEST(COALESCE(price, 0), 0),
  images = COALESCE(images, '[]'::jsonb),
  stock_quantity = GREATEST(COALESCE(stock_quantity, 0), 0),
  min_stock_quantity = GREATEST(COALESCE(min_stock_quantity, 0), 0),
  dimensions = COALESCE(dimensions, '{}'::jsonb),
  active = COALESCE(active, true),
  featured = COALESCE(featured, false),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.products
  ALTER COLUMN sku SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN price SET DEFAULT 0,
  ALTER COLUMN price SET NOT NULL,
  ALTER COLUMN images SET DEFAULT '[]'::jsonb,
  ALTER COLUMN images SET NOT NULL,
  ALTER COLUMN stock_quantity SET DEFAULT 0,
  ALTER COLUMN stock_quantity SET NOT NULL,
  ALTER COLUMN min_stock_quantity SET DEFAULT 0,
  ALTER COLUMN min_stock_quantity SET NOT NULL,
  ALTER COLUMN dimensions SET DEFAULT '{}'::jsonb,
  ALTER COLUMN dimensions SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN featured SET DEFAULT false,
  ALTER COLUMN featured SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS products_slug_idx ON public.products (slug);
CREATE INDEX IF NOT EXISTS products_sku_idx ON public.products (sku);
CREATE INDEX IF NOT EXISTS products_store_list_idx
  ON public.products (active, category_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_category_id_fkey'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_catalog_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_catalog_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
