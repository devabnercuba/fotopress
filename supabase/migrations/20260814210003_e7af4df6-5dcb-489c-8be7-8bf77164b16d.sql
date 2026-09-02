GRANT ALL ON public.billing_events TO service_role;
GRANT SELECT ON public.billing_events TO authenticated;
GRANT ALL ON public.billing_settings TO service_role;
GRANT ALL ON public.user_access TO service_role;
GRANT ALL ON public.admin_audit TO service_role;