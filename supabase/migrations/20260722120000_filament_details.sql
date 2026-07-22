ALTER TABLE public.filaments
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC(10, 2);

CREATE INDEX IF NOT EXISTS filaments_material_color_idx
ON public.filaments (material_id, color)
WHERE active = true;
