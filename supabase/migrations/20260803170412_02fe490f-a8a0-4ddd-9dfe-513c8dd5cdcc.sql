CREATE TABLE public.content_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'url',
  competition_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
  url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_sources TO anon, authenticated;
GRANT ALL ON public.content_sources TO service_role;
ALTER TABLE public.content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access content_sources" ON public.content_sources FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_content_sources_updated_at BEFORE UPDATE ON public.content_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.match_radar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  summary text,
  news jsonb NOT NULL DEFAULT '[]'::jsonb,
  attention_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources_used jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_radar TO anon, authenticated;
GRANT ALL ON public.match_radar TO service_role;
ALTER TABLE public.match_radar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access match_radar" ON public.match_radar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_match_radar_updated_at BEFORE UPDATE ON public.match_radar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();