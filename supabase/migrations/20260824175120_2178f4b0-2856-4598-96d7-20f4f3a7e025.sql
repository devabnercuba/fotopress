ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS photo_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid,
  ADD COLUMN IF NOT EXISTS deletion_batch_id uuid;

CREATE TABLE IF NOT EXISTS public.athlete_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  provider text NOT NULL,
  url text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  sport text,
  category text,
  status text NOT NULL DEFAULT 'active',
  last_sync_at timestamptz,
  last_error text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_data_sources TO authenticated;
GRANT ALL ON public.athlete_data_sources TO service_role;
ALTER TABLE public.athlete_data_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own athlete sources" ON public.athlete_data_sources
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_athlete_data_sources_updated_at BEFORE UPDATE ON public.athlete_data_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.athlete_source_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.athlete_data_sources(id) ON DELETE CASCADE,
  external_player_id text,
  source_name text,
  source_full_name text,
  source_team_name text,
  created_by_source boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  created_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, athlete_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_source_links TO authenticated;
GRANT ALL ON public.athlete_source_links TO service_role;
ALTER TABLE public.athlete_source_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own athlete source links" ON public.athlete_source_links
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS athlete_source_links_source_idx ON public.athlete_source_links (source_id);
CREATE INDEX IF NOT EXISTS athlete_source_links_athlete_idx ON public.athlete_source_links (athlete_id);
CREATE INDEX IF NOT EXISTS athletes_active_idx ON public.athletes (user_id) WHERE deleted_at IS NULL;