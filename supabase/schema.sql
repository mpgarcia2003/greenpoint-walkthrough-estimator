create extension if not exists "pgcrypto";

create table if not exists public.walkthroughs (
  id uuid primary key default gen_random_uuid(),
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

create index if not exists walkthroughs_created_at_idx
  on public.walkthroughs (created_at desc);

alter table public.walkthroughs enable row level security;

revoke all on public.walkthroughs from anon, authenticated;
grant usage on schema public to service_role;
grant all on public.walkthroughs to service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists walkthroughs_touch_updated_at on public.walkthroughs;
create trigger walkthroughs_touch_updated_at
before update on public.walkthroughs
for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('walkthrough-files', 'walkthrough-files', false)
on conflict (id) do nothing;
