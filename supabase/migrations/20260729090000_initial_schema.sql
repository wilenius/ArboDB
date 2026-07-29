-- ArboDB initial schema
-- Registry of an arboretum: taxa, plantings (batches), individual trees,
-- observations, tags, photos, and imported map layers.
--
-- Conventions:
--   * All identifiers and comments in English; the UI is Finnish.
--   * Status changes are timestamped, never destructive, so a historical
--     timeline view can be added later (spec section 7).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

create type origin_type      as enum ('planted', 'original');
create type planting_status  as enum ('active', 'removed', 'dead');
create type tree_status      as enum ('alive', 'dead', 'removed');
create type position_source  as enum ('gps', 'manual');
create type observation_kind as enum ('growth', 'care', 'damage', 'phenology', 'other');

-- --------------------------------------------------------------- tables ----

create table taxa (
  id                    uuid primary key default gen_random_uuid(),
  genus                 text not null,
  species               text,
  infraspecific_rank    text,
  infraspecific_epithet text,
  cultivar              text,
  name_fi               text,
  mustila_url           text,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column taxa.cultivar is 'Cultivar epithet, rendered in single quotes and upright type.';

-- Full scientific name, assembled once here so every view renders it the same.
create or replace function taxon_scientific_name(t taxa)
returns text language sql immutable as $$
  select trim(regexp_replace(
    concat_ws(' ',
      t.genus,
      t.species,
      nullif(concat_ws(' ', t.infraspecific_rank, t.infraspecific_epithet), ''),
      case when t.cultivar is not null then '''' || t.cultivar || '''' end
    ), '\s+', ' ', 'g'));
$$;

create table plantings (
  id               uuid primary key default gen_random_uuid(),
  taxon_id         uuid not null references taxa (id) on delete restrict,
  accession_code   text unique,
  planted_year     int,
  planted_month    int check (planted_month between 1 and 12),
  count_planted    int not null default 1 check (count_planted >= 0),
  seedling_size_cm int,
  propagation      text,
  provenance       text,
  origin_type      origin_type     not null default 'planted',
  status           planting_status not null default 'active',
  status_changed_at timestamptz,
  -- Optional area/centroid position for batches with no individual trees.
  lat              double precision,
  lon              double precision,
  radius_m         double precision,
  published        boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index plantings_taxon_idx  on plantings (taxon_id);
create index plantings_status_idx on plantings (status);

create table trees (
  id                  uuid primary key default gen_random_uuid(),
  planting_id         uuid not null references plantings (id) on delete cascade,
  label               text,
  lat                 double precision,
  lon                 double precision,
  position_accuracy_m double precision,
  position_source     position_source,
  status              tree_status not null default 'alive',
  status_changed_at   timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index trees_planting_idx on trees (planting_id);

create table observations (
  id          uuid primary key default gen_random_uuid(),
  planting_id uuid not null references plantings (id) on delete cascade,
  tree_id     uuid references trees (id) on delete cascade,
  observed_at timestamptz not null default now(),
  kind        observation_kind not null default 'other',
  height_cm   int,
  diameter_mm int,
  body        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index observations_planting_idx on observations (planting_id);
create index observations_tree_idx     on observations (tree_id);
create index observations_date_idx     on observations (observed_at desc);

create table tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#2F5D3F',
  created_at timestamptz not null default now()
);

create table observation_tags (
  observation_id uuid not null references observations (id) on delete cascade,
  tag_id         uuid not null references tags (id) on delete cascade,
  primary key (observation_id, tag_id)
);

create index observation_tags_tag_idx on observation_tags (tag_id);

create table photos (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid references observations (id) on delete cascade,
  tree_id        uuid references trees (id) on delete cascade,
  planting_id    uuid references plantings (id) on delete cascade,
  storage_path   text not null,
  thumb_path     text,
  taken_at       timestamptz,
  caption        text,
  created_at     timestamptz not null default now(),
  constraint photos_needs_a_target check (
    observation_id is not null or tree_id is not null or planting_id is not null
  )
);

create index photos_observation_idx on photos (observation_id);
create index photos_planting_idx    on photos (planting_id);

-- Imported basemap material: a plot boundary (GeoJSON) or a georeferenced
-- raster the owner exported from MML / a drone flight.
create table map_layers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  kind         text not null check (kind in ('geojson', 'image')),
  storage_path text,
  geojson      jsonb,
  -- Corner coordinates in WGS84 for image overlays, [W, S, E, N].
  bounds       double precision[],
  opacity      double precision not null default 1.0,
  visible      boolean not null default true,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------- triggers ----

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger taxa_touch         before update on taxa         for each row execute function touch_updated_at();
create trigger plantings_touch    before update on plantings    for each row execute function touch_updated_at();
create trigger trees_touch        before update on trees        for each row execute function touch_updated_at();
create trigger observations_touch before update on observations for each row execute function touch_updated_at();

-- Stamp status_changed_at whenever a status actually changes, so the history
-- extension in spec section 7 has something to build a timeline from.
create or replace function stamp_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create trigger plantings_status_stamp before update on plantings for each row execute function stamp_status_change();
create trigger trees_status_stamp     before update on trees     for each row execute function stamp_status_change();

-- Accession codes: "2017-004", assigned per planting year on insert.
-- Arboreta label stakes with these, so they are the primary human handle.
create or replace function assign_accession_code()
returns trigger language plpgsql as $$
declare
  yr   text := coalesce(new.planted_year::text, 'XXXX');
  next int;
begin
  if new.accession_code is not null then
    return new;
  end if;
  select coalesce(max(split_part(accession_code, '-', 2)::int), 0) + 1
    into next
    from plantings
   where accession_code like yr || '-%';
  new.accession_code := yr || '-' || lpad(next::text, 3, '0');
  return new;
end;
$$;

create trigger plantings_accession before insert on plantings for each row execute function assign_accession_code();

-- --------------------------------------------------------------- grants ----
-- Table privileges and row level security are separate gates and PostgREST
-- needs both: without these grants every request fails with 42501 long before
-- a policy is ever consulted. The grants are deliberately broad; the policies
-- below are what actually decide who sees which rows.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant select on tables to anon;

-- ------------------------------------------------------------------ RLS ----
-- Two kinds of reader: any authenticated account (owner + developer) has full
-- access; anonymous visitors see only what hangs off a planting the owner has
-- flagged `published`.

alter table taxa             enable row level security;
alter table plantings        enable row level security;
alter table trees            enable row level security;
alter table observations     enable row level security;
alter table tags             enable row level security;
alter table observation_tags enable row level security;
alter table photos           enable row level security;
alter table map_layers       enable row level security;

create policy taxa_rw             on taxa             for all to authenticated using (true) with check (true);
create policy plantings_rw        on plantings        for all to authenticated using (true) with check (true);
create policy trees_rw            on trees            for all to authenticated using (true) with check (true);
create policy observations_rw     on observations     for all to authenticated using (true) with check (true);
create policy tags_rw             on tags             for all to authenticated using (true) with check (true);
create policy observation_tags_rw on observation_tags for all to authenticated using (true) with check (true);
create policy photos_rw           on photos           for all to authenticated using (true) with check (true);
create policy map_layers_rw       on map_layers       for all to authenticated using (true) with check (true);

-- Public, read-only surface for the published report section.
create policy plantings_public on plantings for select to anon
  using (published);

create policy taxa_public on taxa for select to anon
  using (exists (select 1 from plantings p where p.taxon_id = taxa.id and p.published));

create policy trees_public on trees for select to anon
  using (exists (select 1 from plantings p where p.id = trees.planting_id and p.published));

create policy observations_public on observations for select to anon
  using (exists (select 1 from plantings p where p.id = observations.planting_id and p.published));

create policy observation_tags_public on observation_tags for select to anon
  using (exists (
    select 1 from observations o join plantings p on p.id = o.planting_id
     where o.id = observation_tags.observation_id and p.published));

create policy tags_public on tags for select to anon using (true);

create policy photos_public on photos for select to anon
  using (exists (select 1 from plantings p where p.id = photos.planting_id and p.published));

-- ------------------------------------------------------------- storage ----

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true), ('maps', 'maps', true)
on conflict (id) do nothing;

create policy "photos readable by anyone"
  on storage.objects for select using (bucket_id in ('photos', 'maps'));

create policy "photos writable when signed in"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('photos', 'maps'));

create policy "photos deletable when signed in"
  on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'maps'));
