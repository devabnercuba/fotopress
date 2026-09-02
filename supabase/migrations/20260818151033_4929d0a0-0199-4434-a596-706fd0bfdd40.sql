-- Modalidades do usuário (preferência de interface) reaproveitando app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sports jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Novidades do PressBrief (conteúdo global publicado pelo administrador)
CREATE TABLE IF NOT EXISTS public.product_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'novidade',
  icon text,
  related_route text,
  published_at timestamptz NOT NULL DEFAULT now(),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_updates TO authenticated;
GRANT ALL ON public.product_updates TO service_role;

ALTER TABLE public.product_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados leem novidades publicadas"
  ON public.product_updates FOR SELECT TO authenticated
  USING (is_published OR public.is_master_admin(auth.uid()));

CREATE POLICY "Admin master cria novidades"
  ON public.product_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_master_admin(auth.uid()));

CREATE POLICY "Admin master edita novidades"
  ON public.product_updates FOR UPDATE TO authenticated
  USING (public.is_master_admin(auth.uid()))
  WITH CHECK (public.is_master_admin(auth.uid()));

CREATE POLICY "Admin master exclui novidades"
  ON public.product_updates FOR DELETE TO authenticated
  USING (public.is_master_admin(auth.uid()));

CREATE TRIGGER update_product_updates_updated_at
  BEFORE UPDATE ON public.product_updates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leitura individual das novidades
CREATE TABLE IF NOT EXISTS public.product_update_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_id uuid NOT NULL REFERENCES public.product_updates(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, update_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_update_reads TO authenticated;
GRANT ALL ON public.product_update_reads TO service_role;

ALTER TABLE public.product_update_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cada usuário gerencia suas próprias leituras"
  ON public.product_update_reads FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);