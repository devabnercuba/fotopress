-- ============ roles ============
do $$ begin
  create type public.app_role as enum ('admin','user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
drop policy if exists "read own roles" on public.user_roles;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

insert into public.user_roles (user_id, role)
values ('e6fce9c0-651c-4635-862a-a0b044a66031','admin')
on conflict do nothing;

-- ============ ownership columns ============
alter table public.matches add column if not exists user_id uuid default auth.uid();
alter table public.match_radar add column if not exists user_id uuid default auth.uid();
alter table public.news_items add column if not exists user_id uuid default auth.uid();
alter table public.import_history add column if not exists user_id uuid default auth.uid();

update public.matches set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.match_radar set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.news_items set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.import_history set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.athletes set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.coverages set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.agenda set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.data_sources set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.content_sources set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;
update public.app_settings set user_id = 'e6fce9c0-651c-4635-862a-a0b044a66031' where user_id is null;

create index if not exists matches_user_id_idx on public.matches(user_id);
create index if not exists match_radar_user_id_idx on public.match_radar(user_id);
create index if not exists news_items_user_id_idx on public.news_items(user_id);

drop index if exists public.matches_unique_fixture;
create unique index matches_unique_fixture on public.matches(user_id, competition_id, date, "time", home_team, away_team);

-- ============ strict per-user policies ============
drop policy if exists "authenticated matches" on public.matches;
create policy "own matches" on public.matches for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "authenticated match_radar" on public.match_radar;
create policy "own match_radar" on public.match_radar for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "authenticated news_items" on public.news_items;
create policy "own news_items" on public.news_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "authenticated import_history" on public.import_history;
create policy "own import_history" on public.import_history for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy athletes" on public.athletes;
create policy "own athletes" on public.athletes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy coverages" on public.coverages;
create policy "own coverages" on public.coverages for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy agenda" on public.agenda;
create policy "own agenda" on public.agenda for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy data_sources" on public.data_sources;
create policy "own data_sources" on public.data_sources for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy content_sources" on public.content_sources;
create policy "own content_sources" on public.content_sources for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own or legacy app_settings" on public.app_settings;
create policy "own app_settings" on public.app_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ feature suggestions ============
create table if not exists public.feature_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text not null default 'geral',
  status text not null default 'new',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.feature_suggestions to authenticated;
grant all on public.feature_suggestions to service_role;
alter table public.feature_suggestions enable row level security;

create policy "read own or admin suggestions" on public.feature_suggestions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own suggestions" on public.feature_suggestions for insert to authenticated
  with check (user_id = auth.uid());
create policy "update own or admin suggestions" on public.feature_suggestions for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "delete own or admin suggestions" on public.feature_suggestions for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create trigger feature_suggestions_updated_at before update on public.feature_suggestions
  for each row execute function public.update_updated_at_column();