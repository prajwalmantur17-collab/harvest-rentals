-- Upgrade: owner PIN, busy-until date, district fallback, spelling-tolerant search.
create extension if not exists pg_trgm with schema extensions;

alter table public.machines
  add column if not exists pin_hash text,
  add column if not exists busy_until date,
  add column if not exists district_key text;

create or replace function public.machines_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.district_key := lower(regexp_replace(btrim(new.owner_district), '\s+', ' ', 'g'));
  new.village_keys := coalesce((
    select array_agg(distinct k) from (
      select lower(regexp_replace(btrim(v), '\s+', ' ', 'g')) as k
      from unnest(array[new.owner_village] || new.service_villages) as v
    ) s where k <> ''
  ), '{}'::text[]);
  return new;
end $$;

update public.machines set owner_village = owner_village;  -- backfill keys for existing rows
create index if not exists machines_district_idx on public.machines (district_key);

-- The public may read only safe columns (never pin_hash).
revoke select on public.machines from anon, authenticated;
grant select (id, owner_name, owner_phone, owner_village, owner_district, machine_name, machine_photo_url,
  supported_crops, other_crop_name, service_villages, pricing_type, price, is_active, busy_until,
  created_at, updated_at) on public.machines to anon, authenticated;

-- Search: same village (or a close spelling), else same district if the farmer gave one.
-- Hides machines busy on the needed date. SECURITY DEFINER so it can use the key columns;
-- it only returns safe columns.
create or replace function public.search_machines(
  p_village text, p_crop text, p_district text default null, p_needed date default null)
returns table (id uuid, owner_name text, owner_phone text, owner_village text, owner_district text,
  machine_name text, machine_photo_url text, supported_crops text[], other_crop_name text,
  service_villages text[], pricing_type text, price numeric, is_active boolean, busy_until date,
  created_at timestamptz, updated_at timestamptz, match_level text)
language sql stable security definer set search_path = public, extensions as $$
  with q as (
    select lower(regexp_replace(btrim(p_village), '\s+', ' ', 'g')) as v,
           nullif(lower(regexp_replace(btrim(coalesce(p_district, '')), '\s+', ' ', 'g')), '') as d)
  select m.id, m.owner_name, m.owner_phone, m.owner_village, m.owner_district, m.machine_name,
         m.machine_photo_url, m.supported_crops, m.other_crop_name, m.service_villages,
         m.pricing_type, m.price, m.is_active, m.busy_until, m.created_at, m.updated_at,
         case when x.vm then 'village' else 'district' end
  from public.machines m
  cross join q
  cross join lateral (select (q.v = any(m.village_keys)
      or exists (select 1 from unnest(m.village_keys) k where similarity(k, q.v) >= 0.5)) as vm) x
  where m.is_active
    and p_crop = any(m.supported_crops)
    and (p_needed is null or m.busy_until is null or m.busy_until < p_needed)
    and (x.vm or (q.d is not null and m.district_key = q.d))
  order by x.vm desc, m.created_at desc
  limit 50;
$$;
grant execute on function public.search_machines(text, text, text, date) to anon, authenticated;
