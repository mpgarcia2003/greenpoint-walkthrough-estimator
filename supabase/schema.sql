create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'manager', 'estimator', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.walkthroughs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  client_name text,
  facility_name text,
  facility_type text,
  total_rooms integer not null default 0,
  total_minutes integer not null default 0,
  total_hours numeric not null default 0,
  monthly_price numeric not null default 0,
  annual_price numeric not null default 0,
  monthly_profit numeric not null default 0,
  annual_profit numeric not null default 0,
  estimate jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.walkthroughs
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table public.walkthroughs
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists walkthroughs_created_at_idx
  on public.walkthroughs (created_at desc);

create index if not exists walkthroughs_organization_id_idx
  on public.walkthroughs (organization_id, created_at desc);

create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists organizations_touch_updated_at on public.organizations;
create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function public.touch_updated_at();

drop trigger if exists walkthroughs_touch_updated_at on public.walkthroughs;
create trigger walkthroughs_touch_updated_at
before update on public.walkthroughs
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(
  target_organization_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = target_user_id
  );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[],
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = target_user_id
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(organization_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(organization_name), auth.uid())
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  return new_organization_id;
end;
$$;

grant usage on schema public to authenticated, service_role;
grant execute on function public.is_org_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, text[], uuid) to authenticated, service_role;
grant execute on function public.create_organization(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.walkthroughs enable row level security;

revoke all on public.profiles from anon;
revoke all on public.organizations from anon;
revoke all on public.organization_members from anon;
revoke all on public.walkthroughs from anon;
grant all on public.profiles to service_role;
grant all on public.organizations to service_role;
grant all on public.organization_members to service_role;
grant all on public.walkthroughs to service_role;
grant select, update on public.profiles to authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update, delete on public.walkthroughs to authenticated;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Members can read organizations" on public.organizations;
create policy "Members can read organizations"
on public.organizations for select
to authenticated
using (public.is_org_member(id));

drop policy if exists "Owners and admins can update organizations" on public.organizations;
create policy "Owners and admins can update organizations"
on public.organizations for update
to authenticated
using (public.has_org_role(id, array['owner', 'admin']))
with check (public.has_org_role(id, array['owner', 'admin']));

drop policy if exists "Members can read organization members" on public.organization_members;
create policy "Members can read organization members"
on public.organization_members for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Members can read walkthroughs" on public.walkthroughs;
create policy "Members can read walkthroughs"
on public.walkthroughs for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Members can create walkthroughs" on public.walkthroughs;
create policy "Members can create walkthroughs"
on public.walkthroughs for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_org_member(organization_id)
);

drop policy if exists "Members can update walkthroughs" on public.walkthroughs;
create policy "Members can update walkthroughs"
on public.walkthroughs for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "Members can delete walkthroughs" on public.walkthroughs;
create policy "Members can delete walkthroughs"
on public.walkthroughs for delete
to authenticated
using (public.is_org_member(organization_id));

insert into storage.buckets (id, name, public)
values ('walkthrough-files', 'walkthrough-files', false)
on conflict (id) do nothing;

drop policy if exists "Members can read walkthrough files" on storage.objects;
create policy "Members can read walkthrough files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'walkthrough-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Members can upload walkthrough files" on storage.objects;
create policy "Members can upload walkthrough files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'walkthrough-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Members can update walkthrough files" on storage.objects;
create policy "Members can update walkthrough files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'walkthrough-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'walkthrough-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Members can delete walkthrough files" on storage.objects;
create policy "Members can delete walkthrough files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'walkthrough-files'
  and public.is_org_member(((storage.foldername(name))[1])::uuid)
);
