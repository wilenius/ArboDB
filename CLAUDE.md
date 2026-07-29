# Working on ArboDB

A register for a private arboretum: taxa, plantings, individual specimens, field
observations, a map over Finnish aerial imagery. SvelteKit 2 + Svelte 5, static
SPA, Supabase (Postgres + PostgREST + GoTrue + Storage).

`README.md` explains the architecture and the design system. `DEPLOYING.md`
covers the server. This file is only the things that are easy to get wrong and
cheap to state.

## Conventions

- **The UI is Finnish; code, schema, comments and commit messages are English.**
  Every user-facing string lives in `src/lib/i18n.ts` — never inline one in a
  component, even a single word.
- **Svelte 5 runes** (`$state`, `$derived`, `$props`, `$effect`). Not the Svelte
  4 store syntax, and not `export let`.
- **`npm run check` must be clean before committing.** 0 errors, 0 warnings.
- Routes are Finnish (`/kartta`, `/rekisteri`, `/puutarhat`); files and
  identifiers are English. That split is deliberate, not drift.

## Typography is load-bearing

Two rules carry the visual identity, and both are enforced by using the right
component rather than by remembering:

- **A scientific name always renders through `<SciName>`.** Newsreader italic,
  cultivar epithets upright in single quotes. Never hand-format a binomial, not
  even in a chart title or a page heading.
- **Anything measured or counted gets `.data`** (IBM Plex Mono): coordinates,
  distances, accession codes, heights, dates, counts.

## Traps that cost real time

- **Grants and RLS are separate gates.** PostgREST needs a table `GRANT` *and* a
  policy. A new table needs both or it returns `42501`.
- **Filtering on an embedded resource needs `!inner`.** Plain
  `.eq('plantings.garden_id', id)` keeps every parent row and merely blanks the
  embed — it looks like it works and silently returns everything.
- **Never gate map painting on `map.isStyleLoaded()`.** Inside MapLibre's own
  `load` handler it can report false while sources finish, silently skipping the
  first paint with no error. `MapView.repaint()` is the single entry point; it
  re-runs on `idle` after a basemap swap.
- **Migrations are not idempotent.** Plain `create table` / `create policy`.
  Apply with `scripts/apply-migrations.sh`, which records what it has run.
- **`PUBLIC_*` variables are inlined at build time**, not read at runtime.
  Changing `.env` does nothing until a rebuild.
- **Finnish map material is EPSG:3067.** `src/lib/geo.ts` holds the transverse
  Mercator maths; there is no proj4 dependency. Project before computing areas,
  or hectares are wrong by the cosine of the latitude.

## Data model

Everything hangs off a **garden**: `plantings.garden_id` scopes field mode, the
map, the registry, reports and exports. Query helpers in `src/lib/data.ts` take
the active garden from `src/lib/gardens.svelte.ts` — a new screen should scope
itself too rather than assuming a single plot. Taxa and tags are global on
purpose.

A planting is a batch; a tree is an individually tracked specimen within it.
Plantings with no trees are positioned by their own centroid. Status changes are
stamped by a trigger rather than overwriting, so history accumulates for the
timeline in spec §7.

## Demo data

`supabase/seed.sql` holds a demo garden — the boundary is the real plot, the 17
plantings and 20 specimens in it are invented, as is the "Polut" map layer.
`npm run db:reset` reloads it. **Never run it against a server holding real
data**: it also creates accounts whose passwords are published in this repo.
