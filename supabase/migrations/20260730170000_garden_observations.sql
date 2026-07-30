-- A diary, not only a per-tree log.
--
-- Half of what happens in an arboretum is not about one tree: thinning the
-- natural forest, a week of rain, a yard project, a fence line rebuilt. Until
-- now `observations.planting_id` was NOT NULL, so all of that either went
-- unrecorded or got attached to whichever seedling happened to be nearby —
-- which is worse than not recording it, because it corrupts that seedling's
-- history.
--
-- The alternative to this migration was a separate `journal_entries` table.
-- Rejected: tags, photos, the observation feed, the reports and the exports all
-- already hang off `observations`, and a parallel table would have doubled
-- every one of them permanently. What actually differs between "the larch has
-- borers" and "thinned the spruce along the north edge" is only what the entry
-- points at, so that is the sole thing this changes.

-- Weather is the one genuinely new category; thinning and yard work are 'care'
-- and always were.
alter type observation_kind add value 'weather';

-- Every entry belongs to a plot, whether or not it belongs to a planting.
-- Added nullable, backfilled, then tightened, because the column has to be
-- populated before it can be required.
alter table observations
  add column garden_id uuid references gardens (id) on delete cascade;

update observations o
   set garden_id = p.garden_id
  from plantings p
 where p.id = o.planting_id;

-- A database with observations but no gardens cannot exist — the gardens
-- migration created one for exactly this case — but a row whose planting was
-- somehow unscoped would block the NOT NULL, so give it the first plot rather
-- than fail the deploy.
update observations
   set garden_id = (select id from gardens order by sort_order, created_at limit 1)
 where garden_id is null;

-- An entry about a planting already knows its plot, and making every caller
-- look it up and pass it in is how the two end up disagreeing. Only a diary
-- entry with no planting has to name its garden.
create or replace function default_observation_garden()
returns trigger language plpgsql as $$
begin
  if new.garden_id is null and new.planting_id is not null then
    select garden_id into new.garden_id from plantings where id = new.planting_id;
  end if;
  return new;
end;
$$;

create trigger observations_default_garden
  before insert on observations
  for each row execute function default_observation_garden();

alter table observations alter column garden_id set not null;

alter table observations alter column planting_id drop not null;

-- An entry about a specimen is necessarily about its batch too.
alter table observations
  add constraint observations_tree_needs_planting
  check (tree_id is null or planting_id is not null);

-- Where it happened, when that is the point: a thinned corner, a fallen tree,
-- the spot a fence gave way. `radius_m` sketches an area rather than a point,
-- the same way a batch's centroid does.
alter table observations
  add column lat        double precision,
  add column lon        double precision,
  add column accuracy_m double precision,
  add column radius_m   double precision;

create index observations_garden_idx on observations (garden_id, observed_at desc);

comment on column observations.planting_id is
  'Null for a diary entry about the plot rather than about a planting.';

-- ------------------------------------------------------------------ RLS ----
-- The public policies derive publication from the parent planting, so an entry
-- with no planting is invisible to anonymous readers. That is the right
-- default — plot-level notes are working notes — but it does mean publishing a
-- garden diary later needs its own flag rather than falling out of this.
--
-- Nothing to change here: `exists (... where p.id = observations.planting_id
-- and p.published)` is already false when planting_id is null. Stated because
-- the silence would otherwise look like an oversight.
