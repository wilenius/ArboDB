-- Empty the register for real data, keeping the plot itself.
--
-- Run once, on the server, when the owner is ready to start entering his own
-- records over the demo content from seed.sql. It is not part of the migration
-- sequence and apply-migrations.sh will not run it.
--
-- What survives: the `gardens` row. Its boundary is the real plot, traced over
-- the aerial photo, and the app has nothing to scope itself to without it.
-- Tags survive too — they are an empty vocabulary once the observations that
-- used them are gone, and re-typing twelve of them by hand is pointless work.
-- So does the species list, with its invented notes and links stripped.
--
-- What goes: every planting, specimen, observation, diary entry, placement,
-- photo row, drawn feature and imported map layer.
--
-- Everything is in one transaction, so a failure anywhere leaves the database
-- exactly as it was.

begin;

select 'before' as when,
       (select count(*) from plantings)    as plantings,
       (select count(*) from trees)        as trees,
       (select count(*) from observations) as observations,
       (select count(*) from placements)   as placements,
       (select count(*) from features)     as features,
       (select count(*) from taxa)         as taxa,
       (select count(*) from gardens)      as gardens;

-- Diary entries hang off the garden, not off a planting, so deleting the
-- plantings would leave them behind. This clears both kinds; observation_tags
-- and any photos attached to an observation cascade from here.
delete from observations;

-- Cascades to trees, placements and photos. Plantings are the only thing
-- holding taxa down (on delete restrict), so this has to precede the taxa.
delete from plantings;

-- Hand-drawn plot furniture: the invented paths, wall, fence and lawn.
delete from features;

-- Imported material. Nothing in seed.sql inserts here, so this is normally a
-- no-op — it catches anything uploaded while trying the app out. Rows only:
-- the files themselves are removed in a separate step, see DEPLOYING.md.
delete from map_layers;

-- Belt and braces: photos are reachable only through the three tables above,
-- all of which cascade, so this should already be empty.
delete from photos;

-- The taxa themselves stay: the genus/species/cultivar and Finnish names are
-- correct and worth having as a starting list. What goes is the two columns
-- that were written to make the demo read well — notes that are invented
-- claims about this plot ("Tontin alkuperäistä puustoa") and Mustila links
-- that were mostly guessed from the binomial rather than looked up.
update taxa set notes = null, mustila_url = null;

select 'after' as when,
       (select count(*) from plantings)    as plantings,
       (select count(*) from trees)        as trees,
       (select count(*) from observations) as observations,
       (select count(*) from placements)   as placements,
       (select count(*) from features)     as features,
       (select count(*) from taxa)         as taxa,
       (select count(*) from gardens)      as gardens;

commit;
