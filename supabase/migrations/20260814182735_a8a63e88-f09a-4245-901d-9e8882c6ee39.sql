CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles r
    JOIN auth.users u ON u.id = r.user_id
    WHERE r.user_id = _user_id
      AND r.role = 'admin'::app_role
      AND lower(u.email) = 'cubaabner@gmail.com'
  )
$$;

REVOKE ALL ON FUNCTION public.is_master_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "read own or admin suggestions" ON public.feature_suggestions;
DROP POLICY IF EXISTS "update own or admin suggestions" ON public.feature_suggestions;
DROP POLICY IF EXISTS "delete own or admin suggestions" ON public.feature_suggestions;

CREATE POLICY "read own or master admin suggestions" ON public.feature_suggestions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));

CREATE POLICY "update own or master admin suggestions" ON public.feature_suggestions
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()))
WITH CHECK (user_id = auth.uid() OR public.is_master_admin(auth.uid()));

CREATE POLICY "delete own or master admin suggestions" ON public.feature_suggestions
FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_master_admin(auth.uid()));

DROP POLICY IF EXISTS "master admin reads all roles" ON public.user_roles;
CREATE POLICY "master admin reads all roles" ON public.user_roles
FOR SELECT TO authenticated
USING (public.is_master_admin(auth.uid()));