DROP INDEX IF EXISTS public.billing_events_provider_event_uniq;
ALTER TABLE public.user_access ADD COLUMN IF NOT EXISTS billing_product_id text;