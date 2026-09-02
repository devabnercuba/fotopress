ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS amount_cents integer,
  ADD COLUMN IF NOT EXISTS currency text;

UPDATE public.billing_events
SET is_test = true
WHERE provider = 'kiwify' AND (result = 'test_event' OR lower(coalesce(buyer_email,'')) LIKE '%@example.com');

CREATE UNIQUE INDEX IF NOT EXISTS billing_events_provider_event_uniq
  ON public.billing_events (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_events_transaction_idx
  ON public.billing_events (provider, transaction_id);

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS billing_provider text,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE public.user_access SET billing_provider = source WHERE billing_provider IS NULL AND source IN ('kiwify','hotmart');