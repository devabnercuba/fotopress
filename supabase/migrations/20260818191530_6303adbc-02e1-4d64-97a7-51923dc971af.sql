CREATE OR REPLACE FUNCTION public.my_access()
 RETURNS TABLE(access_type access_type_t, access_status access_status_t, plan_code text, lifetime_access boolean, trial_started_at timestamp with time zone, trial_ends_at timestamp with time zone, days_left integer, is_active boolean)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  select
    a.access_type,
    case
      when a.lifetime_access then 'active'::public.access_status_t
      when a.access_status = 'trial' and a.trial_ends_at < now() then 'expired'::public.access_status_t
      else a.access_status
    end,
    a.plan_code,
    a.lifetime_access,
    a.trial_started_at,
    a.trial_ends_at,
    greatest(0, ceil(extract(epoch from (a.trial_ends_at - now())) / 86400))::int,
    (a.lifetime_access or a.access_status = 'active'
      or (a.access_status = 'trial' and a.trial_ends_at >= now()))
  from public.user_access a
  where a.user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when auth.uid() is not null and _user_id is distinct from auth.uid() then false
    else exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
  end
$function$;

CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when auth.uid() is not null and _user_id is distinct from auth.uid() then false
    else exists (
      SELECT 1
      FROM public.user_roles r
      JOIN auth.users u ON u.id = r.user_id
      WHERE r.user_id = _user_id
        AND r.role = 'admin'::app_role
        AND lower(u.email) = 'cubaabner@gmail.com'
    )
  end
$function$;

REVOKE EXECUTE ON FUNCTION public.enforce_master_admin() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_single_featured_tutorial() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.force_trial_defaults() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_master_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_access() FROM anon;