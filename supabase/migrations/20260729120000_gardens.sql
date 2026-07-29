-- Gardens: the plot a planting stands in.
--
-- Until now the arboretum's location lived in two env vars and an imported map
-- layer, so nothing in the database knew where the plot was or what it was
-- called. A garden owns its name, its boundary, and the view the map opens on.
--
-- One row is enough for the MVP. The column is on `plantings` rather than on
-- `trees` because a planted batch belongs to a plot as a whole, and it is
-- nullable so this migration can be applied to a database that already has
-- rows in it.

create table gardens (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  notes        text,
  -- Where the map opens. Derived from the boundary when one is drawn, but
  -- stored so a garden without a boundary still has a usable view.
  center_lat   double precision,
  center_lon   double precision,
  default_zoom double precision not null default 17,
  -- A GeoJSON Polygon geometry in WGS84. Hand-drawn to start with; replace it
  -- wholesale when real survey data arrives.
  boundary     jsonb,
  boundary_source text not null default 'drawn'
    check (boundary_source in ('drawn', 'imported', 'survey')),
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on column gardens.boundary_source is
  'How the boundary was obtained, so a crude hand-drawn outline is never mistaken for surveyed geofence data.';

create trigger gardens_touch before update on gardens
  for each row execute function touch_updated_at();

alter table plantings
  add column garden_id uuid references gardens (id) on delete restrict;

create index plantings_garden_idx on plantings (garden_id);

-- Applying this to a database that already holds plantings: give them a home
-- rather than leaving them stranded outside every garden.
do $$
declare
  default_garden uuid;
begin
  if exists (select 1 from plantings where garden_id is null) then
    insert into gardens (name, notes, boundary_source)
    values ('Arboretum', 'Luotu automaattisesti olemassa olevista istutuksista.', 'drawn')
    returning id into default_garden;

    update plantings set garden_id = default_garden where garden_id is null;

    -- Centre the new garden on whatever is actually positioned in it, so the
    -- map opens somewhere useful before any boundary is drawn.
    update gardens g
       set center_lat = sub.lat, center_lon = sub.lon
      from (
        select avg(lat) as lat, avg(lon) as lon
          from (
            select lat, lon from trees where lat is not null
            union all
            select lat, lon from plantings where lat is not null
          ) pts
      ) sub
     where g.id = default_garden and sub.lat is not null;
  end if;
end $$;

-- ------------------------------------------------------------------ RLS ----

alter table gardens enable row level security;

grant select, insert, update, delete on gardens to authenticated;
grant select on gardens to anon;

create policy gardens_rw on gardens for all to authenticated using (true) with check (true);

-- A garden becomes public only once something in it is published.
create policy gardens_public on gardens for select to anon
  using (exists (select 1 from plantings p where p.garden_id = gardens.id and p.published));
