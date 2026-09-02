ALTER TABLE public.athlete_match_engagements
  ADD COLUMN IF NOT EXISTS no_response boolean NOT NULL DEFAULT false;