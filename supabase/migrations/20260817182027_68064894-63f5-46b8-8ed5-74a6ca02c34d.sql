ALTER TABLE public.content_sources
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS feed_type text NOT NULL DEFAULT 'news',
  ADD COLUMN IF NOT EXISTS guid text,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE UNIQUE INDEX IF NOT EXISTS news_items_user_guid_key
  ON public.news_items (user_id, guid) WHERE guid IS NOT NULL;

CREATE INDEX IF NOT EXISTS news_items_user_feed_type_idx
  ON public.news_items (user_id, feed_type, published_at DESC);