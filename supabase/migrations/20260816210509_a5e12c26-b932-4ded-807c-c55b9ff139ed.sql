ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS competitions_deleted_at_idx ON public.competitions (deleted_at);
CREATE INDEX IF NOT EXISTS data_sources_deleted_at_idx ON public.data_sources (deleted_at);