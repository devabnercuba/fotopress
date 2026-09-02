-- ENUMS
create type public.access_type_t as enum ('trial','founder','monthly','annual','professional','business');
create type public.access_status_t as enum ('trial','active','expired','cancelled');

-- PLANS (catálogo)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  billing_period text not null default 'one_time',
  lifetime boolean not null default false,
  features jsonb not null default '[]'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.plans to anon;
grant select on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "plans are publicly readable" on public.plans for select to anon, authenticated using (active = true);
create policy "master admin manages plans" on public.plans for all to authenticated
  using (public.is_master_admin(auth.uid())) with check (public.is_master_admin(auth.uid()));
create trigger update_plans_updated_at before update on public.plans
  for each row execute function public.update_updated_at_column();

-- USER ACCESS
create table public.user_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  access_type public.access_type_t not null default 'trial',
  access_status public.access_status_t not null default 'trial',
  plan_code text,
  lifetime_access boolean not null default false,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '7 days',
  activated_at timestamptz,
  source text,
  external_transaction_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.user_access to authenticated;
grant all on public.user_access to service_role;
alter table public.user_access enable row level security;
create policy "read own access" on public.user_access for select to authenticated
  using (user_id = auth.uid() or public.is_master_admin(auth.uid()));
create policy "start own trial" on public.user_access for insert to authenticated
  with check (user_id = auth.uid());

-- O banco é a fonte da verdade: qualquer inserção feita pelo usuário vira um trial de 7 dias.
create or replace function public.force_trial_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) is distinct from 'service_role' and auth.uid() is not null then
    new.access_type := 'trial';
    new.access_status := 'trial';
    new.plan_code := null;
    new.lifetime_access := false;
    new.activated_at := null;
    new.source := 'signup';
    new.external_transaction_id := null;
    new.trial_started_at := now();
    new.trial_ends_at := now() + interval '7 days';
  end if;
  return new;
end;
$$;
create trigger force_trial_defaults_trg before insert on public.user_access
  for each row execute function public.force_trial_defaults();
create trigger update_user_access_updated_at before update on public.user_access
  for each row execute function public.update_updated_at_column();

-- Situação real de acesso, calculada no banco.
create or replace function public.my_access()
returns table (
  access_type public.access_type_t,
  access_status public.access_status_t,
  plan_code text,
  lifetime_access boolean,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  days_left integer,
  is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
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
$$;
revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- BILLING EVENTS (webhook)
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'hotmart',
  event text not null,
  status text,
  product_id text,
  offer_id text,
  transaction_id text,
  buyer_email text,
  user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  processed boolean not null default false,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.billing_events to authenticated;
grant all on public.billing_events to service_role;
alter table public.billing_events enable row level security;
create policy "master admin reads billing events" on public.billing_events for select to authenticated
  using (public.is_master_admin(auth.uid()));

-- BILLING SETTINGS (configuração Hotmart, sem segredos no frontend)
create table public.billing_settings (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique default 'hotmart',
  product_id text,
  offer_id text,
  checkout_url text,
  environment text not null default 'production',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.billing_settings to authenticated;
grant all on public.billing_settings to service_role;
alter table public.billing_settings enable row level security;
create policy "master admin manages billing settings" on public.billing_settings for all to authenticated
  using (public.is_master_admin(auth.uid())) with check (public.is_master_admin(auth.uid()));
create trigger update_billing_settings_updated_at before update on public.billing_settings
  for each row execute function public.update_updated_at_column();
insert into public.billing_settings (provider) values ('hotmart');

-- INTERESSE EM FUNCIONALIDADES FUTURAS
create table public.feature_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now(),
  unique (user_id, feature)
);
grant select, insert, delete on public.feature_interest to authenticated;
grant all on public.feature_interest to service_role;
alter table public.feature_interest enable row level security;
create policy "own feature interest" on public.feature_interest for all to authenticated
  using (user_id = auth.uid() or public.is_master_admin(auth.uid()))
  with check (user_id = auth.uid());

-- PLANO INICIAL
insert into public.plans (code, name, description, price_cents, billing_period, lifetime, features, sort_order)
values (
  'founder',
  'PressBrief — Acesso Fundador',
  'Acesso vitalício ao PressBrief para os recursos incluídos no produto, incluindo futuras funcionalidades disponibilizadas aos usuários do plano fundador.',
  29700,
  'one_time',
  true,
  '["Recursos atuais","Futuras funcionalidades incluídas no plano fundador","Atualizações do produto","Perfil personalizado","Organização de jogos","Minha Agenda","Credenciamentos","Atletas","Radar","Fontes"]'::jsonb,
  1
);