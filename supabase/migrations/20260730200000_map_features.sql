-- Things on the plot that are not trees: paths, stone walls, lawns, game
-- fences, ditches, buildings.
--
-- The aerial photo shows a canopy and a roof and very little else. Everything
-- the owner navigates by is either under the trees or too small to resolve, so
-- the map is unusable as a working document until those can be drawn onto it.
--
-- Kept apart from `map_layers` on purpose. That table is for material imported
-- wholesale — a survey file, an orthophoto, the property register's outline —
-- which is opaque, arrives complete, and is replaced rather than edited. These
-- are drawn a vertex at a time, named, restyled and corrected, and want a row
-- each rather than a blob.

create type feature_kind as enum (
  'path', 'wall', 'fence', 'ditch', 'lawn', 'bed', 'building', 'other'
);

create table features (
  id         uuid primary key default gen_random_uuid(),
  garden_id  uuid not null references gardens (id) on delete cascade,
  name       text,
  kind       feature_kind not null default 'other',
  -- A GeoJSON geometry in WGS84: LineString for a path or a wall, Polygon for
  -- a lawn or a bed. Stored as given rather than split into two tables — the
  -- difference is how it is drawn, not what it is.
  geometry   jsonb not null,
  notes      text,
  visible    boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index features_garden_idx on features (garden_id, sort_order);

comment on column features.geometry is
  'GeoJSON geometry in WGS84. LineString or Polygon; the kind decides the styling, not the type.';

create trigger features_touch before update on features
  for each row execute function touch_updated_at();

-- --------------------------------------------------------- grants + RLS ----

grant select, insert, update, delete on features to authenticated;
grant select on features to anon;

alter table features enable row level security;

create policy features_rw on features
  for all to authenticated using (true) with check (true);

-- Visible to anonymous readers wherever the garden itself is: a path shown on
-- a published catalogue's map gives away nothing that the published plantings
-- do not already.
create policy features_public on features for select to anon
  using (exists (
    select 1 from plantings p where p.garden_id = features.garden_id and p.published
  ));
