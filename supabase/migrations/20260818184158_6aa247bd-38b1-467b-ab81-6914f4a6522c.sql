DROP INDEX IF EXISTS public.matches_unique_fixture;
CREATE UNIQUE INDEX matches_unique_fixture
  ON public.matches (user_id, competition_id, date, "time", home_team, away_team)
  WHERE deleted_at IS NULL;