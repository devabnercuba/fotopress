-- 1. Identidade de times
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS sport_key text NOT NULL DEFAULT 'futebol',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS gender text;

CREATE OR REPLACE FUNCTION public.identity_key(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(
      lower(btrim(regexp_replace(translate(coalesce(_value, ''),
        'ÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑàáâãäåèéêëìíîïòóôõöùúûüçñ',
        'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn'), '[^a-zA-Z0-9]+', ' ', 'g'))),
      ''),
    '')
$$;

DROP INDEX IF EXISTS public.teams_user_normalized_name_key;
DROP INDEX IF EXISTS public.teams_user_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS teams_identity_key ON public.teams (
  user_id,
  public.identity_key(normalized_name),
  public.identity_key(sport_key),
  public.identity_key(category),
  public.identity_key(gender)
);

-- 2. Contexto das competições
ALTER TABLE public.competitions
  ADD COLUMN IF NOT EXISTS sport_key text NOT NULL DEFAULT 'futebol',
  ADD COLUMN IF NOT EXISTS gender text;

-- 3. Blindagem financeira
ALTER TABLE public.financial_entries
  DROP CONSTRAINT IF EXISTS financial_entries_match_id_fkey,
  DROP CONSTRAINT IF EXISTS financial_entries_event_id_fkey,
  DROP CONSTRAINT IF EXISTS financial_entries_one_coverage;

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_match_id_fkey
    FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL,
  ADD CONSTRAINT financial_entries_event_id_fkey
    FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL,
  ADD CONSTRAINT financial_entries_one_coverage
    CHECK (NOT (match_id IS NOT NULL AND event_id IS NOT NULL));

ALTER TABLE public.financial_entries
  ADD COLUMN IF NOT EXISTS coverage_label text,
  ADD COLUMN IF NOT EXISTS coverage_date date,
  ADD COLUMN IF NOT EXISTS coverage_type text;

UPDATE public.financial_entries f
SET coverage_label = m.home_team || ' x ' || m.away_team,
    coverage_date = m.date,
    coverage_type = 'match'
FROM public.matches m
WHERE f.match_id = m.id AND f.coverage_label IS NULL;

UPDATE public.financial_entries f
SET coverage_label = e.name,
    coverage_date = e.start_date,
    coverage_type = 'event'
FROM public.events e
WHERE f.event_id = e.id AND f.coverage_label IS NULL;

-- 4. Mesclagem segura de times duplicados
CREATE OR REPLACE FUNCTION public.merge_teams(p_keep_id uuid, p_drop_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _keep public.teams%ROWTYPE;
  _drop public.teams%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_keep_id = p_drop_id THEN RAISE EXCEPTION 'Times iguais'; END IF;

  SELECT * INTO _keep FROM public.teams WHERE id = p_keep_id AND user_id = _uid;
  SELECT * INTO _drop FROM public.teams WHERE id = p_drop_id AND user_id = _uid;
  IF _keep.id IS NULL OR _drop.id IS NULL THEN RAISE EXCEPTION 'Time não encontrado'; END IF;

  UPDATE public.matches SET home_team_id = p_keep_id WHERE home_team_id = p_drop_id AND user_id = _uid;
  UPDATE public.matches SET away_team_id = p_keep_id WHERE away_team_id = p_drop_id AND user_id = _uid;
  UPDATE public.athletes SET team_id = p_keep_id WHERE team_id = p_drop_id AND user_id = _uid;
  UPDATE public.athlete_data_sources SET team_id = p_keep_id WHERE team_id = p_drop_id AND user_id = _uid;

  -- Escudo: nunca perder um logo manual/local já existente
  UPDATE public.teams
     SET logo_local = coalesce(_keep.logo_local, _drop.logo_local),
         logo_url = coalesce(_keep.logo_url, _drop.logo_url),
         city = coalesce(_keep.city, _drop.city),
         state = coalesce(_keep.state, _drop.state),
         abbreviation = coalesce(_keep.abbreviation, _drop.abbreviation)
   WHERE id = p_keep_id;

  DELETE FROM public.teams WHERE id = p_drop_id AND user_id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_teams(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_teams(uuid, uuid) TO authenticated;