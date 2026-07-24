-- Harden materials schema used by admin materials, filaments, public materials and quote calculator.
-- This migration is intentionally additive and safe for an existing production database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  price_per_kg numeric(10, 2) NOT NULL DEFAULT 0,
  image_url text,
  available boolean DEFAULT true,
  print_temp_min integer,
  print_temp_max integer,
  bed_temp_min integer,
  bed_temp_max integer,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS price_per_kg numeric(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS available boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS print_temp_min integer,
  ADD COLUMN IF NOT EXISTS print_temp_max integer,
  ADD COLUMN IF NOT EXISTS bed_temp_min integer,
  ADD COLUMN IF NOT EXISTS bed_temp_max integer,
  ADD COLUMN IF NOT EXISTS properties jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.materials
SET
  name = coalesce(nullif(name, ''), 'Materiał ' || left(id::text, 8)),
  slug = lower(regexp_replace(coalesce(nullif(slug, ''), name, id::text), '[^a-zA-Z0-9]+', '-', 'g')),
  price_per_kg = coalesce(price_per_kg, 0),
  available = coalesce(available, true),
  properties = coalesce(properties, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

ALTER TABLE public.materials
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN slug SET NOT NULL,
  ALTER COLUMN price_per_kg SET DEFAULT 0,
  ALTER COLUMN price_per_kg SET NOT NULL,
  ALTER COLUMN properties SET DEFAULT '{}'::jsonb,
  ALTER COLUMN properties SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS materials_slug_idx ON public.materials (slug);
CREATE INDEX IF NOT EXISTS materials_available_name_idx ON public.materials (available, name);

CREATE OR REPLACE FUNCTION public.set_materials_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS materials_set_updated_at ON public.materials;
CREATE TRIGGER materials_set_updated_at
BEFORE UPDATE ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.set_materials_updated_at();

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
