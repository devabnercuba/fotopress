-- Eventos esportivos (não seguem o formato mandante x visitante)
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sport text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  start_time time,
  end_time time,
  venue text,
  city text,
  state text,
  organizer text,
  official_url text,
  accreditation_required boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own events" ON public.events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX events_user_date_idx ON public.events (user_id, start_date);

-- Categorias próprias do evento
CREATE TABLE public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_categories TO authenticated;
GRANT ALL ON public.event_categories TO service_role;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own event categories" ON public.event_categories
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX event_categories_event_idx ON public.event_categories (event_id);

-- Cobertura de evento (paralela a coverages, sem alterar partidas)
CREATE TABLE public.event_coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  credential_status text NOT NULL DEFAULT 'not_requested',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_coverages TO authenticated;
GRANT ALL ON public.event_coverages TO service_role;
ALTER TABLE public.event_coverages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own event coverages" ON public.event_coverages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_event_coverages_updated_at BEFORE UPDATE ON public.event_coverages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Relacionamento comercial atleta x evento
CREATE TABLE public.athlete_event_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_category_id uuid REFERENCES public.event_categories(id) ON DELETE SET NULL,
  contact_status text NOT NULL DEFAULT 'not_contacted',
  contacted_at timestamptz,
  package_status text NOT NULL DEFAULT 'not_offered',
  package_name text,
  package_value numeric,
  no_response boolean NOT NULL DEFAULT false,
  notes text,
  next_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, athlete_id, event_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_event_engagements TO authenticated;
GRANT ALL ON public.athlete_event_engagements TO service_role;
ALTER TABLE public.athlete_event_engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own event engagements" ON public.athlete_event_engagements
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX athlete_event_engagements_event_idx ON public.athlete_event_engagements (event_id);
CREATE TRIGGER update_athlete_event_engagements_updated_at BEFORE UPDATE ON public.athlete_event_engagements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Modalidade do atleta/cliente (opcional, não quebra cadastros de futebol)
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS sport text;