CREATE OR REPLACE FUNCTION public.enforce_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
    IF _email IS DISTINCT FROM 'cubaabner@gmail.com' THEN
      RAISE EXCEPTION 'Somente o administrador master pode ter o papel admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_master_admin_trg ON public.user_roles;
CREATE TRIGGER enforce_master_admin_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_master_admin();

DELETE FROM public.user_roles r
USING auth.users u
WHERE r.user_id = u.id
  AND r.role = 'admin'::app_role
  AND u.email IS DISTINCT FROM 'cubaabner@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'cubaabner@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;