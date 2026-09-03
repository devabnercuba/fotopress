CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Futebol',
  color text NOT NULL DEFAULT 'gray',
  season text NOT NULL DEFAULT '2026',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES public.competitions(id) ON DELETE CASCADE,
  home_team text NOT NULL,
  away_team text NOT NULL,
  date date NOT NULL,
  time time NOT NULL DEFAULT '19:00',
  venue text,
  city text,
  state text,
  source text NOT NULL DEFAULT 'Importação Manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id)
);

CREATE INDEX matches_date_idx ON public.matches(date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role;
GRANT ALL ON public.matches TO service_role;
GRANT ALL ON public.agenda TO service_role;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public access competitions" ON public.competitions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public access matches" ON public.matches FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public access agenda" ON public.agenda FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
