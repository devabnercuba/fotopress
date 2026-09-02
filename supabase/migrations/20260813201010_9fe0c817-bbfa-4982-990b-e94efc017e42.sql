ALTER TABLE public.content_sources ALTER COLUMN competition_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.content_sources(id) ON DELETE SET NULL,
  url text NOT NULL,
  title text NOT NULL,
  summary text,
  excerpt text,
  published_at timestamptz,
  fact_key text,
  status text NOT NULL DEFAULT 'collected',
  entities jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_team_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_competition_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_match_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_athlete_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS news_items_url_key ON public.news_items (url);
CREATE INDEX IF NOT EXISTS news_items_fact_key_idx ON public.news_items (fact_key);
CREATE INDEX IF NOT EXISTS news_items_source_idx ON public.news_items (source_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO anon;
GRANT ALL ON public.news_items TO service_role;

ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access news_items" ON public.news_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_news_items_updated_at BEFORE UPDATE ON public.news_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();