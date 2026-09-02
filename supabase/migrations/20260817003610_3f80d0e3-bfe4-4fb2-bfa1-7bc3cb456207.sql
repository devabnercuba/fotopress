ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

UPDATE public.competitions SET user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031'::uuid WHERE user_id IS NULL;
UPDATE public.teams SET user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031'::uuid WHERE user_id IS NULL;

ALTER TABLE public.competitions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.teams ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS competitions_user_id_idx ON public.competitions(user_id);
CREATE INDEX IF NOT EXISTS teams_user_id_idx ON public.teams(user_id);

DROP POLICY IF EXISTS "authenticated competitions" ON public.competitions;
DROP POLICY IF EXISTS "authenticated teams" ON public.teams;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own competitions" ON public.competitions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own teams" ON public.teams FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());