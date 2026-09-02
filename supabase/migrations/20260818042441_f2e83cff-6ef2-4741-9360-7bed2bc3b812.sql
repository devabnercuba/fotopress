CREATE TABLE public.help_page_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.help_page_sections TO authenticated;
GRANT ALL ON public.help_page_sections TO service_role;

ALTER TABLE public.help_page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read help sections"
ON public.help_page_sections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Master admin can manage help sections"
ON public.help_page_sections FOR ALL TO authenticated
USING (public.is_master_admin(auth.uid()))
WITH CHECK (public.is_master_admin(auth.uid()));

GRANT INSERT, UPDATE, DELETE ON public.help_page_sections TO authenticated;

CREATE TRIGGER update_help_page_sections_updated_at
BEFORE UPDATE ON public.help_page_sections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.help_page_sections (section_key, sort_order) VALUES
  ('videos', 0),
  ('setup_checklist', 1),
  ('guides', 2),
  ('additional_content', 3);