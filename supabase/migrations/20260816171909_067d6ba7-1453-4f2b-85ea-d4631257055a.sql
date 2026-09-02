ALTER TABLE public.webhook_diagnostics
  ADD COLUMN IF NOT EXISTS authenticated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS event text,
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;