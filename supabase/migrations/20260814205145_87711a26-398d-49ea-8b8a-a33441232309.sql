
ALTER TABLE public.billing_settings
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS offer_name text,
  ADD COLUMN IF NOT EXISTS price_cents integer;

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS provider_event_id text,
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'ignored',
  ADD COLUMN IF NOT EXISTS error_reason text,
  ADD COLUMN IF NOT EXISTS linked_manually boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS buyer_name text,
  ADD COLUMN IF NOT EXISTS event_version text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

UPDATE public.billing_events SET result = CASE WHEN processed THEN 'processed' ELSE 'ignored' END WHERE result = 'ignored';

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_id_key
  ON public.billing_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- Token do webhook: acessível somente pelo service_role (nunca pela Data API)
CREATE TABLE IF NOT EXISTS public.billing_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  webhook_token text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_secrets TO service_role;
ALTER TABLE public.billing_secrets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_billing_secrets_updated_at BEFORE UPDATE ON public.billing_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Histórico administrativo
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit TO authenticated;
GRANT ALL ON public.admin_audit TO service_role;
ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Master admin can read audit" ON public.admin_audit
  FOR SELECT TO authenticated USING (public.is_master_admin(auth.uid()));
