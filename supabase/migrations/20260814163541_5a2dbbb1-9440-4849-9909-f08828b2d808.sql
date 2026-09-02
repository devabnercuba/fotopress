-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  first_name text,
  last_name text,
  professional_name text,
  email text,
  city text,
  state text,
  bio text,
  photo_url text,
  logo_url text,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OWNERSHIP COLUMNS
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.agenda ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.coverages ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.data_sources ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();
ALTER TABLE public.content_sources ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "public access app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "public access athletes" ON public.athletes;
DROP POLICY IF EXISTS "public access agenda" ON public.agenda;
DROP POLICY IF EXISTS "public access coverages" ON public.coverages;
DROP POLICY IF EXISTS "public access data_sources" ON public.data_sources;
DROP POLICY IF EXISTS "public access content_sources" ON public.content_sources;

CREATE POLICY "own or legacy app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "own or legacy athletes" ON public.athletes FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "own or legacy agenda" ON public.agenda FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "own or legacy coverages" ON public.coverages FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "own or legacy data_sources" ON public.data_sources FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
CREATE POLICY "own or legacy content_sources" ON public.content_sources FOR ALL TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL) WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- SHARED TABLES: require login
DROP POLICY IF EXISTS "public access competitions" ON public.competitions;
DROP POLICY IF EXISTS "public access matches" ON public.matches;
DROP POLICY IF EXISTS "public access teams" ON public.teams;
DROP POLICY IF EXISTS "public access news_items" ON public.news_items;
DROP POLICY IF EXISTS "public access match_radar" ON public.match_radar;
DROP POLICY IF EXISTS "public access import_history" ON public.import_history;

CREATE POLICY "authenticated competitions" ON public.competitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated matches" ON public.matches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated teams" ON public.teams FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated news_items" ON public.news_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated match_radar" ON public.match_radar FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated import_history" ON public.import_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.competitions FROM anon;
REVOKE ALL ON public.matches FROM anon;
REVOKE ALL ON public.teams FROM anon;
REVOKE ALL ON public.news_items FROM anon;
REVOKE ALL ON public.match_radar FROM anon;
REVOKE ALL ON public.import_history FROM anon;
REVOKE ALL ON public.agenda FROM anon;
REVOKE ALL ON public.app_settings FROM anon;
REVOKE ALL ON public.athletes FROM anon;
REVOKE ALL ON public.coverages FROM anon;
REVOKE ALL ON public.data_sources FROM anon;
REVOKE ALL ON public.content_sources FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_radar TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_sources TO authenticated;
GRANT ALL ON public.competitions, public.matches, public.teams, public.news_items, public.match_radar, public.import_history, public.agenda, public.app_settings, public.athletes, public.coverages, public.data_sources, public.content_sources TO service_role;