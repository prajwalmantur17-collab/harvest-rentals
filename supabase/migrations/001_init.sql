-- Harvest Rentals: schema, security policies, storage bucket.

create extension if not exists pgcrypto;

create table public.machines (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null check (char_length(owner_name) between 2 and 80),
  owner_phone text not null check (owner_phone ~ '^[6-9][0-9]{9}$'),
  owner_village text not null check (char_length(owner_village) between 2 and 80),
  owner_district text not null check (char_length(owner_district) between 2 and 80),
  machine_name text not null check (char_length(machine_name) between 2 and 80),
  machine_photo_url text check (machine_photo_url is null or machine_photo_url ~ '^https://'),
  supported_crops text[] not null
    check (cardinality(supported_crops) >= 1
      and supported_crops <@ array['paddy','wheat','maize','sugarcane','soybean','jowar','ragi','other']),
  other_crop_name text check (other_crop_name is null or char_length(other_crop_name) between 2 and 60),
  service_villages text[] not null default '{}' check (cardinality(service_villages) <= 20),
  village_keys text[] not null default '{}',   -- filled by trigger: normalized owner + service villages
  pricing_type text not null check (pricing_type in ('per_acre','per_hour','per_day')),
  price numeric(10,2) not null check (price > 0 and price <= 1000000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint other_crop_needs_name check (not ('other' = any(supported_crops)) or other_crop_name is not null)
);

create or replace function public.machines_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  -- Same normalization as the app: trim, collapse spaces, lowercase.
  new.village_keys := coalesce((
    select array_agg(distinct k) from (
      select lower(regexp_replace(btrim(v), '\s+', ' ', 'g')) as k
      from unnest(array[new.owner_village] || new.service_villages) as v
    ) s where k <> ''
  ), '{}'::text[]);
  return new;
end $$;

create trigger machines_before_write before insert or update on public.machines
  for each row execute function public.machines_before_write();

create index machines_crops_idx on public.machines using gin (supported_crops);
create index machines_villages_idx on public.machines using gin (village_keys);
create index machines_active_idx on public.machines (is_active, created_at desc);

-- Public can only READ active listings. No public insert/update/delete.
alter table public.machines enable row level security;
revoke all on public.machines from anon, authenticated;
grant select on public.machines to anon, authenticated;
create policy "public read active machines" on public.machines
  for select to anon, authenticated using (is_active);

-- Reports of wrong listings (write-only for the public).
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  reason text not null check (reason = 'incorrect'),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant insert on public.reports to anon, authenticated;
create policy "public can report" on public.reports
  for insert to anon, authenticated with check (reason = 'incorrect');

-- Rate-limit log, used only by the Edge Function (service role). No policies = no public access.
create table public.submission_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index submission_log_idx on public.submission_log (ip_hash, created_at desc);
alter table public.submission_log enable row level security;
revoke all on public.submission_log from anon, authenticated;

-- Photo bucket: public read by URL, 3 MB, images only. No storage.objects policies for
-- anon => uploads are only possible through the Edge Function (service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('machine-photos', 'machine-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
