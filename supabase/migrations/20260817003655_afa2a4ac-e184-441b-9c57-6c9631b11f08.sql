ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_name_key;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_slug_key;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_normalized_name_key;
DROP INDEX IF EXISTS public.teams_name_key;
DROP INDEX IF EXISTS public.teams_slug_key;
DROP INDEX IF EXISTS public.teams_normalized_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS teams_user_slug_key ON public.teams(user_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS teams_user_normalized_name_key ON public.teams(user_id, normalized_name);