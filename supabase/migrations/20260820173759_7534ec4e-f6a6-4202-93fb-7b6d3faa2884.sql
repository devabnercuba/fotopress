CREATE TABLE public.financial_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL CHECK (type IN ('income','expense')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  category text,
  description text,
  occurred_at date NOT NULL DEFAULT current_date,
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_entries_one_coverage CHECK (
    (match_id IS NOT NULL AND event_id IS NULL) OR (match_id IS NULL AND event_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_entries TO authenticated;
GRANT ALL ON public.financial_entries TO service_role;

ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own financial entries"
ON public.financial_entries FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX financial_entries_user_idx ON public.financial_entries (user_id, occurred_at DESC);
CREATE INDEX financial_entries_match_idx ON public.financial_entries (match_id);
CREATE INDEX financial_entries_event_idx ON public.financial_entries (event_id);

CREATE TRIGGER update_financial_entries_updated_at
BEFORE UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP FUNCTION IF EXISTS public.my_access();

CREATE FUNCTION public.my_access()
RETURNS TABLE(
  access_type public.access_type_t,
  access_status public.access_status_t,
  plan_code text,
  lifetime_access boolean,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  days_left integer,
  is_active boolean,
  is_master boolean
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  select
    a.access_type,
    case
      when public.is_master_admin(auth.uid()) then 'active'::public.access_status_t
      when a.lifetime_access then 'active'::public.access_status_t
      when a.access_status = 'trial' and a.trial_ends_at < now() then 'expired'::public.access_status_t
      else a.access_status
    end,
    case when public.is_master_admin(auth.uid()) then 'master_admin' else a.plan_code end,
    (a.lifetime_access or public.is_master_admin(auth.uid())),
    a.trial_started_at,
    a.trial_ends_at,
    greatest(0, ceil(extract(epoch from (a.trial_ends_at - now())) / 86400))::int,
    (public.is_master_admin(auth.uid()) or a.lifetime_access or a.access_status = 'active'
      or (a.access_status = 'trial' and a.trial_ends_at >= now())),
    public.is_master_admin(auth.uid())
  from public.user_access a
  where a.user_id = auth.uid()
$function$;

REVOKE ALL ON FUNCTION public.my_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_access() TO authenticated;