-- Placements: where a tree has stood, and when.
--
-- Until now a tree had one pair of coordinates, overwritten in place. That
-- loses the thing the owner actually asked for — transplanting. Seedlings are
-- bought, potted on the vegetable patch, and moved to their final spot years
-- later, and the register should be able to say so.
--
-- The distinction this table exists to preserve:
--
--   * The tree moved. The old coordinates were true then and are false now.
--     That is history, and it belongs on the timeline.
--   * The record was wrong. A poor fix under canopy, a marker nudged on the
--     aerial photo. The old coordinates were never true at all.
--
-- Log both without saying which is which and every map drag reads as a
-- transplant, so `reason` carries the difference: only 'acquired', 'planted'
-- and 'moved' are movement. 'corrected' is bookkeeping and is filtered out of
-- the timeline while staying auditable.
--
-- `lat`/`lon` on plantings and trees survive as a cache of the newest
-- placement, maintained by trigger, so the map, field mode and every existing
-- query keep working untouched. Nothing above this file had to change.

create type placement_reason as enum ('acquired', 'planted', 'moved', 'corrected');

create table placements (
  id           uuid primary key default gen_random_uuid(),
  planting_id  uuid not null references plantings (id) on delete cascade,
  -- Null means the placement is the batch's own centroid rather than one
  -- individually tracked specimen's position.
  tree_id      uuid references trees (id) on delete cascade,
  -- Recorded per placement because a move can cross plots: a seedling raised
  -- in the nursery bed and planted out in the arboretum changes garden.
  garden_id    uuid references gardens (id) on delete set null,
  lat          double precision,
  lon          double precision,
  accuracy_m   double precision,
  source       position_source,
  reason       placement_reason not null,
  -- A pot, a nursery bed, a holding row: alive and positioned, but not where
  -- it is meant to end up. Gives "waiting for a final spot" as a query.
  provisional  boolean not null default false,
  -- When it happened, which is rarely when it was typed in. The timeline sorts
  -- on this, so a move entered next February still lands in the right place.
  occurred_on  date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);

create index placements_tree_idx     on placements (tree_id, occurred_on desc);
create index placements_planting_idx on placements (planting_id, occurred_on desc);

comment on column placements.reason is
  'Movement (acquired/planted/moved) versus bookkeeping (corrected). Only movement belongs on the timeline.';

-- ------------------------------------------------------------- helpers ----

-- Planting date as a date, for stamping the first placement of a row that was
-- entered long after it went in the ground.
create or replace function planting_planted_on(p plantings)
returns date language sql immutable as $$
  select case
    when p.planted_year is null then null
    else make_date(p.planted_year, coalesce(p.planted_month, 1), 1)
  end;
$$;

-- The placement in force for a target: the whole point of the table is that
-- "current" is derived, not stored, so this is the single definition of it.
create or replace function newest_placement(p_planting uuid, p_tree uuid)
returns placements language sql stable as $$
  select *
    from placements
   where planting_id = p_planting
     and (case when p_tree is null then tree_id is null else tree_id = p_tree end)
   order by occurred_on desc, created_at desc
   limit 1;
$$;

-- ------------------------------------------------------------ backfill ----
-- Before the triggers exist, so the sync does not fight the seed data.

insert into placements (planting_id, tree_id, garden_id, lat, lon, reason, occurred_on)
select p.id, null, p.garden_id, p.lat, p.lon, 'planted',
       coalesce(planting_planted_on(p), p.created_at::date)
  from plantings p
 where p.lat is not null and p.lon is not null;

insert into placements
  (planting_id, tree_id, garden_id, lat, lon, accuracy_m, source, reason, occurred_on)
select t.planting_id, t.id, p.garden_id, t.lat, t.lon,
       t.position_accuracy_m, t.position_source, 'planted',
       coalesce(planting_planted_on(p), t.created_at::date)
  from trees t
  join plantings p on p.id = t.planting_id
 where t.lat is not null and t.lon is not null;

-- ------------------------------------------------------------- triggers ----
-- The two directions are kept in step by a transaction-local flag. Without it
-- the cache update below would look like a hand edit and log a phantom
-- correction, which would then update the cache, and so on.

create or replace function sync_placement_cache()
returns trigger language plpgsql as $$
declare
  target_planting uuid;
  target_tree     uuid;
  newest          placements;
begin
  if tg_op = 'DELETE' then
    target_planting := old.planting_id;
    target_tree     := old.tree_id;
  else
    target_planting := new.planting_id;
    target_tree     := new.tree_id;
  end if;

  newest := newest_placement(target_planting, target_tree);
  -- Deleting the only placement leaves the cached position alone rather than
  -- blanking a tree off the map as a side effect of tidying its history.
  if newest.id is null then
    return null;
  end if;

  perform set_config('arbodb.syncing', '1', true);

  if target_tree is not null then
    update trees
       set lat                 = newest.lat,
           lon                 = newest.lon,
           position_accuracy_m = newest.accuracy_m,
           position_source     = coalesce(newest.source, position_source)
     where id = target_tree;
  else
    update plantings
       set lat       = newest.lat,
           lon       = newest.lon,
           garden_id = coalesce(newest.garden_id, garden_id)
     where id = target_planting;
  end if;

  perform set_config('arbodb.syncing', '', true);
  return null;
end;
$$;

create trigger placements_sync
  after insert or update or delete on placements
  for each row execute function sync_placement_cache();

-- The other direction: an ordinary edit to lat/lon anywhere in the app becomes
-- a placement without that code having to know this table exists. A first
-- position is where the tree was planted; a later change to coordinates that
-- nobody described as a move is a correction.
create or replace function log_position_change()
returns trigger language plpgsql as $$
declare
  planting_row plantings;
  why          placement_reason;
begin
  if coalesce(current_setting('arbodb.syncing', true), '') = '1' then
    return null;
  end if;
  if new.lat is null or new.lon is null then
    return null;
  end if;
  if tg_op = 'UPDATE'
     and old.lat is not distinct from new.lat
     and old.lon is not distinct from new.lon then
    return null;
  end if;

  why := case when tg_op = 'INSERT' then 'planted'::placement_reason
              else 'corrected'::placement_reason end;

  if tg_table_name = 'trees' then
    select * into planting_row from plantings where id = new.planting_id;
    insert into placements
      (planting_id, tree_id, garden_id, lat, lon, accuracy_m, source, reason, occurred_on)
    values (
      new.planting_id, new.id, planting_row.garden_id, new.lat, new.lon,
      new.position_accuracy_m, new.position_source, why,
      case when why = 'planted'
           then coalesce(planting_planted_on(planting_row), current_date)
           else current_date end
    );
  else
    insert into placements
      (planting_id, tree_id, garden_id, lat, lon, reason, occurred_on)
    values (
      new.id, null, new.garden_id, new.lat, new.lon, why,
      case when why = 'planted'
           then coalesce(planting_planted_on(new), current_date)
           else current_date end
    );
  end if;

  return null;
end;
$$;

create trigger plantings_log_position
  after insert or update of lat, lon on plantings
  for each row execute function log_position_change();

create trigger trees_log_position
  after insert or update of lat, lon on trees
  for each row execute function log_position_change();

-- --------------------------------------------------------- grants + RLS ----
-- Two separate gates, as always: PostgREST needs both or every request comes
-- back 42501 without a policy ever being consulted.

grant select, insert, update, delete on placements to authenticated;
grant select on placements to anon;

alter table placements enable row level security;

create policy placements_rw on placements
  for all to authenticated using (true) with check (true);

create policy placements_public on placements for select to anon
  using (exists (select 1 from plantings p where p.id = placements.planting_id and p.published));
