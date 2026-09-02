ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS relationship text NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS public.athlete_match_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  contact_status text NOT NULL DEFAULT 'not_contacted',
  contacted_at timestamptz,
  package_status text NOT NULL DEFAULT 'not_offered',
  package_name text,
  package_value numeric,
  notes text,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, athlete_id, match_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_match_engagements TO authenticated;
GRANT ALL ON public.athlete_match_engagements TO service_role;

ALTER TABLE public.athlete_match_engagements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own engagements"
  ON public.athlete_match_engagements FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_athlete_match_engagements_updated_at
  BEFORE UPDATE ON public.athlete_match_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();