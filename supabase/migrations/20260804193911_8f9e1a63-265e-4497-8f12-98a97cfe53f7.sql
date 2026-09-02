CREATE TABLE public.coverages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  credential_status text NOT NULL DEFAULT 'requested',
  notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coverages TO anon, authenticated;
GRANT ALL ON public.coverages TO service_role;
ALTER TABLE public.coverages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access coverages" ON public.coverages FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_coverages_updated_at BEFORE UPDATE ON public.coverages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.coverages (match_id, credential_status, completed_at)
SELECT DISTINCT ON (a.match_id) a.match_id, 'approved',
  CASE WHEN a.status = 'completed' THEN now() ELSE NULL END
FROM public.agenda a
WHERE a.match_id IS NOT NULL
ORDER BY a.match_id, a.created_at DESC;

ALTER TABLE public.match_radar ADD COLUMN IF NOT EXISTS coverage_id uuid REFERENCES public.coverages(id) ON DELETE CASCADE;
UPDATE public.match_radar r SET coverage_id = c.id FROM public.coverages c WHERE c.match_id = r.match_id AND r.coverage_id IS NULL;

CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  company text,
  city text,
  state text,
  phone text,
  email text,
  photo_url text,
  logo_url text,
  agency text,
  default_credit text,
  instagram text,
  website text,
  max_radius_km integer,
  min_value numeric,
  favorite_competitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  favorite_states jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme text NOT NULL DEFAULT 'system',
  language text NOT NULL DEFAULT 'pt-BR',
  first_day_of_week integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public access app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.app_settings DEFAULT VALUES;