ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS athletes_category_idx ON public.athletes (user_id, category);