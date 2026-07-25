-- Record worker heartbeats so the admin panel can distinguish a configured
-- token from a Creality Print process that is actually online.

CREATE TABLE IF NOT EXISTS public.slicer_workers (
  id text PRIMARY KEY,
  slicer_name text NOT NULL DEFAULT 'Creality Print',
  slicer_version text,
  printer_profile text,
  process_profile text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slicer_workers_id_check CHECK (char_length(id) BETWEEN 1 AND 120),
  CONSTRAINT slicer_workers_name_check CHECK (char_length(slicer_name) BETWEEN 1 AND 120),
  CONSTRAINT slicer_workers_version_check CHECK (slicer_version IS NULL OR char_length(slicer_version) <= 120),
  CONSTRAINT slicer_workers_printer_profile_check CHECK (printer_profile IS NULL OR char_length(printer_profile) <= 240),
  CONSTRAINT slicer_workers_process_profile_check CHECK (process_profile IS NULL OR char_length(process_profile) <= 240)
);

CREATE INDEX IF NOT EXISTS slicer_workers_last_seen_idx
  ON public.slicer_workers (last_seen_at DESC);

ALTER TABLE public.slicer_workers ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.slicer_workers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.slicer_workers TO service_role;
