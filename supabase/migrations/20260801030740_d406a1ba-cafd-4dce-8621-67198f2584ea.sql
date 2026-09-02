ALTER TABLE public.data_sources
  ADD COLUMN IF NOT EXISTS last_update timestamp with time zone,
  ADD COLUMN IF NOT EXISTS games_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.data_sources(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matches_source_id_idx ON public.matches(source_id);

DROP TRIGGER IF EXISTS update_matches_updated_at ON public.matches;
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_data_sources_updated_at ON public.data_sources;
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON public.data_sources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid REFERENCES public.data_sources(id) ON DELETE CASCADE,
  source_type text NOT NULL DEFAULT 'excel',
  status text NOT NULL DEFAULT 'success',
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  message text,
  batch text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_history TO anon, authenticated;
GRANT ALL ON public.import_history TO service_role;

ALTER TABLE public.import_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access import_history" ON public.import_history
FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS import_history_source_idx ON public.import_history(data_source_id, created_at DESC);