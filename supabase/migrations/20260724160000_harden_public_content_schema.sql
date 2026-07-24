-- Complete the public content tables managed from the admin panel.
-- The migration is additive and keeps all existing blog, FAQ and portfolio rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text,
  cover_image_url text,
  author_id uuid,
  category text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS excerpt text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS author_id uuid,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.blog_posts
SET
  title = COALESCE(NULLIF(trim(title), ''), 'Wpis bez tytułu'),
  slug = COALESCE(
    NULLIF(trim(slug), ''),
    NULLIF(regexp_replace(lower(COALESCE(title, '')), '[^a-z0-9]+', '-', 'g'), ''),
    'wpis-' || left(id::text, 8)
  ),
  tags = COALESCE(tags, '[]'::jsonb),
  published = COALESCE(published, false),
  published_at = CASE
    WHEN COALESCE(published, false) THEN COALESCE(published_at, created_at, now())
    ELSE published_at
  END,
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.blog_posts
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb,
  ALTER COLUMN tags SET NOT NULL,
  ALTER COLUMN published SET DEFAULT false,
  ALTER COLUMN published SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS blog_posts_slug_idx ON public.blog_posts (slug);
CREATE INDEX IF NOT EXISTS blog_posts_public_idx
  ON public.blog_posts (published, published_at DESC);

CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faq_items
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS answer text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.faq_items
SET
  question = COALESCE(NULLIF(trim(question), ''), 'Pytanie bez treści'),
  answer = COALESCE(NULLIF(trim(answer), ''), 'Skontaktuj się z nami przez formularz kontaktowy, a odpowiemy najszybciej jak to możliwe.'),
  sort_order = COALESCE(sort_order, 0),
  active = COALESCE(active, true),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.faq_items
  ALTER COLUMN question SET NOT NULL,
  ALTER COLUMN answer SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS faq_items_public_idx
  ON public.faq_items (active, sort_order);

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  material text,
  category text,
  print_time_hours numeric(12,2),
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS print_time_hours numeric(12,2),
  ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.portfolio_items
SET
  title = COALESCE(NULLIF(trim(title), ''), 'Realizacja bez tytułu'),
  images = COALESCE(images, '[]'::jsonb),
  featured = COALESCE(featured, false),
  active = COALESCE(active, true),
  sort_order = COALESCE(sort_order, 0),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.portfolio_items
  ALTER COLUMN title SET NOT NULL,
  ALTER COLUMN images SET DEFAULT '[]'::jsonb,
  ALTER COLUMN images SET NOT NULL,
  ALTER COLUMN featured SET DEFAULT false,
  ALTER COLUMN featured SET NOT NULL,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN active SET NOT NULL,
  ALTER COLUMN sort_order SET DEFAULT 0,
  ALTER COLUMN sort_order SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS portfolio_items_public_idx
  ON public.portfolio_items (active, sort_order);
CREATE INDEX IF NOT EXISTS portfolio_items_featured_idx
  ON public.portfolio_items (active, featured, sort_order);

CREATE OR REPLACE FUNCTION public.set_public_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blog_posts_set_updated_at ON public.blog_posts;
CREATE TRIGGER blog_posts_set_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_public_content_updated_at();

DROP TRIGGER IF EXISTS faq_items_set_updated_at ON public.faq_items;
CREATE TRIGGER faq_items_set_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_public_content_updated_at();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_posts_public_read ON public.blog_posts;
DROP POLICY IF EXISTS blog_posts_admin_write ON public.blog_posts;
CREATE POLICY blog_posts_public_read ON public.blog_posts
  FOR SELECT TO anon, authenticated
  USING (published OR public.is_admin());
CREATE POLICY blog_posts_admin_write ON public.blog_posts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS faq_items_public_read ON public.faq_items;
DROP POLICY IF EXISTS faq_items_admin_write ON public.faq_items;
CREATE POLICY faq_items_public_read ON public.faq_items
  FOR SELECT TO anon, authenticated
  USING (active OR public.is_admin());
CREATE POLICY faq_items_admin_write ON public.faq_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS portfolio_items_public_read ON public.portfolio_items;
DROP POLICY IF EXISTS portfolio_items_admin_write ON public.portfolio_items;
CREATE POLICY portfolio_items_public_read ON public.portfolio_items
  FOR SELECT TO anon, authenticated
  USING (active OR public.is_admin());
CREATE POLICY portfolio_items_admin_write ON public.portfolio_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
