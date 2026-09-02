-- 1) Move privileged role checks into a non-API schema, keeping public wrappers as SECURITY INVOKER
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon, service_role;

create or replace function private.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is not null and _user_id is distinct from auth.uid() then false
    else exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
  end
$$;

create or replace function private.is_master_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is not null and _user_id is distinct from auth.uid() then false
    else exists (
      select 1
      from public.user_roles r
      join auth.users u on u.id = r.user_id
      where r.user_id = _user_id
        and r.role = 'admin'::public.app_role
        and lower(u.email) = 'cubaabner@gmail.com'
    )
  end
$$;

revoke all on function private.has_role(uuid, public.app_role) from public;
revoke all on function private.is_master_admin(uuid) from public;
grant execute on function private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function private.is_master_admin(uuid) to authenticated, service_role;

-- public wrappers stay callable (RLS policies + app rpc) but no longer run with definer rights
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select private.has_role(_user_id, _role)
$$;

create or replace function public.is_master_admin(_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select private.is_master_admin(_user_id)
$$;

-- my_access() relies on these wrappers; nothing else changes for it.

-- 2) Storage: every authenticated write/read must stay inside the caller's own folder
drop policy if exists "assets insert" on storage.objects;
drop policy if exists "assets update" on storage.objects;
drop policy if exists "assets delete" on storage.objects;
drop policy if exists "assets read" on storage.objects;

create policy "assets read own" on storage.objects
for select to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "assets insert own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "assets update own" on storage.objects
for update to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "assets delete own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'assets'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);