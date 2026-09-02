-- TEAMS: identidade própria e única
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS abbreviation text,
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS normalized_name text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS logo_local text;

-- preenche slug/normalized_name das linhas existentes
UPDATE public.teams
SET normalized_name = COALESCE(
      normalized_name,
      btrim(regexp_replace(lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', ' ', 'g'), ' ')
    ),
    slug = COALESCE(
      slug,
      btrim(regexp_replace(lower(translate(name, 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')), '[^a-z0-9]+', '-', 'g'), '-')
    )
WHERE slug IS NULL OR normalized_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS teams_slug_key ON public.teams (slug);
CREATE UNIQUE INDEX IF NOT EXISTS teams_normalized_name_key ON public.teams (normalized_name);

-- MATCHES: referência aos clubes + observações
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS matches_home_team_id_idx ON public.matches (home_team_id);
CREATE INDEX IF NOT EXISTS matches_away_team_id_idx ON public.matches (away_team_id);