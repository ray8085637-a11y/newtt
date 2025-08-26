-- Enable required extension for UUID generation
create extension if not exists "pgcrypto";

-- app_users table
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text not null,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- taxes table
create table if not exists public.taxes (
  id uuid primary key default gen_random_uuid(),
  station_name text not null,
  tax_type text not null check (tax_type in ('취득세','재산세','기타세')),
  amount integer not null,
  due_date date not null,
  status text not null check (status in ('회계사검토','납부예정','납부완료')),
  memo text,
  is_recurring boolean not null default false,
  recurring_period text,
  reviewed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger function and trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_taxes_updated_at on public.taxes;
create trigger set_taxes_updated_at
before update on public.taxes
for each row execute function public.set_updated_at();

-- RLS policies (permissive for anon to match client-side usage)
alter table public.app_users enable row level security;
alter table public.taxes enable row level security;

-- Allow public read/write (Anon) - NOTE: broad access for prototype usage
create policy if not exists "Allow read to anon" on public.app_users
  for select using (true);
create policy if not exists "Allow write to anon" on public.app_users
  for all using (true) with check (true);

create policy if not exists "Allow read to anon" on public.taxes
  for select using (true);
create policy if not exists "Allow write to anon" on public.taxes
  for all using (true) with check (true);

-- stations table
create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stations enable row level security;
create policy if not exists "Allow read to anon" on public.stations
  for select using (true);
create policy if not exists "Allow write to anon" on public.stations
  for all using (true) with check (true);