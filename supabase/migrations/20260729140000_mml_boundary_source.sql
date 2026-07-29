-- A boundary can now come from Maanmittauslaitos' property register, fetched by
-- property identifier rather than tapped out on an aerial photo.
--
-- 'imported' would have swallowed it, but the whole point of boundary_source is
-- to say how much the outline can be trusted, and "the official register" is a
-- different claim from "a GeoJSON file the owner had lying around".

alter table gardens drop constraint gardens_boundary_source_check;

alter table gardens add constraint gardens_boundary_source_check
  check (boundary_source in ('drawn', 'imported', 'survey', 'mml'));
