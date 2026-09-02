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

INSERT INTO public.competitions (id, name, category, color, season) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Brasileiro Série B', 'CBF', 'green', '2026'),
  ('22222222-2222-2222-2222-222222222222', 'Catarinense Série A', 'FCF', 'blue', '2026'),
  ('33333333-3333-3333-3333-333333333333', 'Catarinense de Futsal', 'Futsal', 'orange', '2026'),
  ('44444444-4444-4444-4444-444444444444', 'Circuito Beach Soccer', 'Beach Soccer', 'yellow', '2026'),
  ('55555555-5555-5555-5555-555555555555', 'Campeonato Amador', 'Amador', 'gray', '2026');

INSERT INTO public.matches (competition_id, home_team, away_team, date, time, venue, city, state, source) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Brusque', 'Avaí', '2026-08-02', '19:00', 'Arena Joinville', 'Joinville', 'SC', 'CBF API'),
  ('11111111-1111-1111-1111-111111111111', 'Chapecoense', 'Criciúma', '2026-08-05', '21:30', 'Arena Condá', 'Chapecó', 'SC', 'CBF API'),
  ('11111111-1111-1111-1111-111111111111', 'Figueirense', 'Brusque', '2026-08-12', '16:00', 'Orlando Scarpelli', 'Florianópolis', 'SC', 'CBF API'),
  ('11111111-1111-1111-1111-111111111111', 'Avaí', 'Chapecoense', '2026-08-22', '18:30', 'Ressacada', 'Florianópolis', 'SC', 'CBF API'),
  ('22222222-2222-2222-2222-222222222222', 'Marcílio Dias', 'Barra', '2026-08-03', '15:30', 'Estádio Hercílio Luz', 'Itajaí', 'SC', 'FCF API'),
  ('22222222-2222-2222-2222-222222222222', 'Concórdia', 'Hercílio Luz', '2026-08-09', '15:00', 'Estádio Domingos Machado', 'Concórdia', 'SC', 'FCF API'),
  ('22222222-2222-2222-2222-222222222222', 'Camboriú', 'Joinville', '2026-08-16', '17:00', 'Estádio Roberto Ferreira', 'Camboriú', 'SC', 'FCF API'),
  ('22222222-2222-2222-2222-222222222222', 'Barra', 'Marcílio Dias', '2026-07-30', '20:00', 'Arena Barra', 'Balneário Camboriú', 'SC', 'FCF API'),
  ('33333333-3333-3333-3333-333333333333', 'Jaraguá Futsal', 'Blumenau Futsal', '2026-08-07', '20:15', 'Arena Jaraguá', 'Jaraguá do Sul', 'SC', 'PDF'),
  ('33333333-3333-3333-3333-333333333333', 'Tubarão Futsal', 'Joinville Futsal', '2026-08-14', '20:00', 'Ginásio Municipal', 'Tubarão', 'SC', 'PDF'),
  ('44444444-4444-4444-4444-444444444444', 'Vasco Beach', 'Corinthians Beach', '2026-08-08', '10:00', 'Praia Central', 'Balneário Camboriú', 'SC', 'Importação Manual'),
  ('44444444-4444-4444-4444-444444444444', 'Flamengo Beach', 'Botafogo Beach', '2026-08-19', '11:00', 'Praia de Cabeçudas', 'Itajaí', 'SC', 'Importação Manual'),
  ('55555555-5555-5555-5555-555555555555', 'Guarani FC', 'União EC', '2026-08-05', '09:30', 'Campo do Bairro', 'Brusque', 'SC', 'Importação Manual'),
  ('55555555-5555-5555-5555-555555555555', 'Final Municipal', 'Vila Nova', '2026-08-23', '10:00', 'Estádio Municipal', 'Gaspar', 'SC', 'Importação Manual'),
  ('55555555-5555-5555-5555-555555555555', 'Bandeirante', 'São Luiz', '2026-07-31', '19:30', 'Campo do Centro', 'Blumenau', 'SC', 'Importação Manual');