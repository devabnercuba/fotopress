CREATE TABLE IF NOT EXISTS public.webhook_diagnostics (
  provider text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL,
  content_type text,
  body_size integer,
  token_present boolean NOT NULL DEFAULT false,
  note text
);
GRANT ALL ON public.webhook_diagnostics TO service_role;
ALTER TABLE public.webhook_diagnostics ENABLE ROW LEVEL SECURITY;