ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS imported_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS import_type text;

CREATE INDEX IF NOT EXISTS matches_import_type_idx ON public.matches (import_type);