CREATE TABLE public.athletes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  position text,
  number integer,
  photo_url text,
  instagram text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athletes TO anon, authenticated;
GRANT ALL ON public.athletes TO service_role;

ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access athletes" ON public.athletes FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_athletes_updated_at BEFORE UPDATE ON public.athletes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX athletes_team_id_idx ON public.athletes(team_id);