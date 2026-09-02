ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_score integer,
  ADD COLUMN IF NOT EXISTS away_score integer,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS broadcast text,
  ADD COLUMN IF NOT EXISTS participants_tbd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS match_number text,
  ADD COLUMN IF NOT EXISTS source_file text;

ALTER TABLE public.import_history
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS file_hash text,
  ADD COLUMN IF NOT EXISTS found integer NOT NULL DEFAULT 0;