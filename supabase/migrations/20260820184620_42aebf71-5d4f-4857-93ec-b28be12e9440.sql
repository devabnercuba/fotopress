ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS article_summary text,
  ADD COLUMN IF NOT EXISTS article_highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS article_content_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS article_enriched_at timestamptz;

ALTER TABLE public.feature_suggestions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'feature_suggestions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_suggestions';
  END IF;
END $$;