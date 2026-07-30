-- Records started in the field and finished at a desk.
--
-- Standing next to a newly planted seedling with cold hands, the useful thing
-- to capture is the position — everything else can wait for a keyboard. But a
-- half-filled record is only safe if the register knows it is half-filled and
-- can hand it back later; otherwise it quietly becomes the permanent version.
--
-- Hence an explicit flag rather than inferring incompleteness from empty
-- columns. Plenty of finished records legitimately have no provenance and no
-- measurements, and guessing would nag about those forever while saying
-- nothing about the one the owner actually meant to come back to.

alter table plantings
  add column incomplete boolean not null default false;

comment on column plantings.incomplete is
  'Started in the field, still to be finished. Cleared by hand, never inferred.';

-- The species is often the one thing that cannot be settled in the field: a
-- nursery label left at home, a seedling grown from collected seed. A planting
-- may now wait for its taxon the same way it waits for everything else.
alter table plantings
  alter column taxon_id drop not null;

create index plantings_incomplete_idx on plantings (incomplete) where incomplete;

-- ------------------------------------------------- placement date, refined ----
-- `planted_year`/`planted_month` only resolve to the first of the month, which
-- is the best available answer for a row imported from an old spreadsheet. It
-- is the wrong answer for a record created in the field this morning: quick
-- capture stamps the current month, and the placement would then be dated up to
-- thirty days before the seedling was in the ground.
--
-- So the approximation is used only where it helps — genuinely historical rows.

create or replace function planting_placement_date(p plantings)
returns date language sql stable as $$
  select case
    when planting_planted_on(p) is null then current_date
    -- Planted this month means planted now, as far as anyone can tell.
    when date_trunc('month', planting_planted_on(p)) = date_trunc('month', current_date)
      then current_date
    else planting_planted_on(p)
  end;
$$;

-- Same body as the original but for the date, which plain SQL migrations have
-- no way to share; see 20260730100000_placements.sql for the commentary.
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
      case when why = 'planted' then planting_placement_date(planting_row)
           else current_date end
    );
  else
    insert into placements
      (planting_id, tree_id, garden_id, lat, lon, reason, occurred_on)
    values (
      new.id, null, new.garden_id, new.lat, new.lon, why,
      case when why = 'planted' then planting_placement_date(new)
           else current_date end
    );
  end if;

  return null;
end;
$$;
