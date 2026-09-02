ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS match_status text;