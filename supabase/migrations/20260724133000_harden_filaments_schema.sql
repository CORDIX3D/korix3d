-- Harden filaments schema used by the admin filament warehouse and quote calculator.
-- The migration is additive and safe for existing production data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.filaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  color text NOT NULL,
  color_hex text DEFAULT '#FFFFFF',
  image_url text,
  price_per_kg numeric(10, 2),
  remaining_weight_grams numeric NOT NULL DEFAULT 0,
  original_weight_grams numeric DEFAULT 1000,
  price_paid numeric(10, 2),
  min_weight_grams numeric DEFAULT 100,
  location text,
  opened_at timestamptz,
  expires_at timestamptz,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.filaments
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS material_id uuid,
  ADD COLUMN IF NOT EXISTS material_name text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS color_hex text DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS price_per_kg numeric(10, 2),
  ADD COLUMN IF NOT EXISTS remaining_weight_grams numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_weight_grams numeric DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS price_paid numeric(10, 2),
  ADD COLUMN IF NOT EXISTS min_weight_grams numeric DEFAULT 100,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.filaments
SET
  brand = coalesce(nullif(brand, ''), 'Nieznana marka'),
  material_name = coalesce(nullif(material_name, ''), 'PLA'),
  color = coalesce(nullif(color, ''), 'Brak koloru'),
  color_hex = coalesce(nullif(color_hex, ''), '#FFFFFF'),
  remaining_weight_grams = coalesce(remaining_weight_grams, 0),
  original_weight_grams = coalesce(original_weight_grams, 1000),
  min_weight_grams = coalesce(min_weight_grams, 100),
  active = coalesce(active, true),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

ALTER TABLE public.filaments
  ALTER COLUMN brand SET NOT NULL,
  ALTER COLUMN material_name SET NOT NULL,
  ALTER COLUMN color SET NOT NULL,
  ALTER COLUMN remaining_weight_grams SET DEFAULT 0,
  ALTER COLUMN remaining_weight_grams SET NOT NULL,
  ALTER COLUMN original_weight_grams SET DEFAULT 1000,
  ALTER COLUMN min_weight_grams SET DEFAULT 100,
  ALTER COLUMN active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'filaments_material_id_fkey'
  ) THEN
    ALTER TABLE public.filaments
      ADD CONSTRAINT filaments_material_id_fkey
      FOREIGN KEY (material_id) REFERENCES public.materials(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS filaments_active_created_at_idx
ON public.filaments (active, created_at DESC);

CREATE INDEX IF NOT EXISTS filaments_material_color_idx
ON public.filaments (material_id, color)
WHERE active = true;

CREATE OR REPLACE FUNCTION public.set_filaments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS filaments_set_updated_at ON public.filaments;
CREATE TRIGGER filaments_set_updated_at
BEFORE UPDATE ON public.filaments
FOR EACH ROW
EXECUTE FUNCTION public.set_filaments_updated_at();

ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;
