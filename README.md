# ArboDB — arboretumin puurekisteri

A mobile-first PWA for keeping the register of a private arboretum: taxa,
plantings, individual specimens, field observations with photos, a map with
Finnish aerial imagery, and a public catalogue of whatever the owner chooses to
publish.

The UI is Finnish. Code, schema, and comments are English.

Built to the brief in [`arboretum-db-spec.md`](arboretum-db-spec.md).

---

## Running it

You need Node 20+ and Docker (for the local Supabase stack).

```bash
npm install
npm run db:start          # starts Postgres, Auth, Storage; applies migrations + seed
cp .env.example .env      # then paste the anon key printed by db:start
npm run dev               # http://localhost:5173
```

`npm run db:start` prints an `ANON_KEY`. Put it in `.env` as
`PUBLIC_SUPABASE_ANON_KEY`.

Demo accounts (seeded, local only):

| Account | Email | Password |
|---|---|---|
| Owner | `omistaja@arbodb.test` | `arbodb-demo` |
| Developer | `yllapito@arbodb.test` | `arbodb-demo` |

Magic-link sign-in also works locally — the mail lands in Mailpit at
<http://127.0.0.1:54324>.

`npm run db:reset` reapplies the migrations and reloads the demo data: one
garden — "Torppa", the 2.32 ha plot in Western Uusimaa, outlined by hand over
the aerial photo — holding 15 taxa, 17 plantings, 20 individually tracked
specimens, 38 observations of which 5 are plot-level diary entries, and four
drawn map features — a path, a stone wall, a game fence and a lawn. Every
specimen sits inside the boundary with at least 6 m to spare, so the map opens
on something that looks like the real site. The boundary is the real one;
everything standing in it is invented.

### Aerial imagery

The map defaults to the Maanmittauslaitos orthophoto, which needs a free API
key. Register one at
<https://www.maanmittauslaitos.fi/rajapinnat/api-avaimen-ohje> and set
`PUBLIC_MML_API_KEY` in `.env`. Without a key the app falls back to
OpenStreetMap and still shows every imported layer — it just tells you the
aerial view is unavailable.

Vite inlines `PUBLIC_*` variables at build time, so restart `npm run dev` after
editing `.env`.

### Property boundaries

The same key opens Maanmittauslaitos' property register (OGC API Features).
Type a property identifier — `710-547-1-180`, or the register's own
`71054700010180` — and the registered parcel outline comes back as WGS84
GeoJSON. It can become a garden's boundary, which is far more accurate than
tapping corners on the photo, or a plain map layer for a neighbouring plot.

The service sends permissive CORS headers, so the lookup runs in the browser
like every other query here. A property split across several detached parcels
contributes its largest one to a boundary, since `gardens.boundary` is a single
Polygon; as a map layer all of them are kept. Editing a fetched outline by hand
demotes its `boundary_source` back to `drawn` — a nudged boundary is no longer
the register's.

---

## What is built

| Spec step | Status |
|---|---|
| 1. Schema, auth, RLS | Done — `supabase/migrations/`, two roles, published-only public read |
| 2. Registry CRUD + CSV import | Done — taxa, plantings, specimens, tags; importer maps Finnish headers |
| 3. Field mode | Done — proximity list, bearing dial, detail cards, observations with photos |
| 4. Map + draggable positions | Done — MML aerial/topographic, drag correction, layer import |
| 5. Tags and bulk retagging | Done — rename, recolour, merge, bulk add/remove |
| 6. Weather snapshot | Out of scope per spec §6 |
| 7. Reports, exports, print CSS | Done — registry, observations, growth charts, gallery; CSV + XLSX |
| 8. Public publishing routes | Done — `/julkinen`, anon key + RLS |

Added after the first pass:

- **Gardens.** A garden is the plot a planting stands in — it owns the name, the
  boundary, and the view the map opens on. Manage them at `/puutarhat`.
- **Placements.** A tree's position is a history, not a coordinate, so
  transplanting can be recorded. `reason` separates a move (the tree is
  somewhere else) from a correction (the record was wrong); only the first is
  history. `lat`/`lon` survive as a trigger-maintained cache of the newest row.
- **Field drafts.** `/istutus/pika` captures a planting from a GPS fix alone and
  marks it incomplete; the registry hands the unfinished ones back as a
  worklist.
- **Diary.** An observation may target a tree, a batch, a spot on the ground, or
  the plot as a whole. `/paivakirja` shows all four in one timeline.
- **Map features.** Hand-drawn paths, walls, lawns and fences at
  `/kartta/kohteet`, traceable on the imagery or by walking them with the phone.
- **Installable.** A service worker makes the app installable on a phone's home
  screen; `/asenna` explains how per platform. The cache covers the shell, not
  the data.

Designed-for-but-not-built, per spec §7: the historical timeline. Every status
change on a planting or a specimen is stamped by a trigger rather than
overwriting, so the history is already accumulating.

## Not built yet

Known gaps in what is above, recorded so they are not rediscovered as bugs.
Roughly in the order they are likely to bite.

- **Walking a feature is untested on a real phone.** `/kartta/kohteet` reads
  `geo.fix` from the running watch, so it should collect a new point per tap as
  you move, but it has only ever been exercised against a stubbed fix that
  could not move. The maths underneath is exercised by the demo features.
  Verify this on the device before trusting a traced wall.
- **Nothing works offline but the shell.** The service worker caches the app so
  a weak signal opens it instead of white-screening; every row still comes from
  Supabase. In real dead ground the app opens to an empty list, and a field
  record cannot be captured at all. Queueing writes locally and syncing later is
  the obvious next step and is a substantially larger piece of work than
  anything in this pass.
- **Part of a batch cannot be moved.** A placement covers one tracked specimen
  or a whole planting. Moving three seedlings out of ten means splitting the
  batch first, which needs a "jaa erä" action and a `split_from_planting_id`
  link. Until then the honest workaround is to promote the moved seedlings to
  individually tracked trees.
- **A tree-level move never changes its planting's garden.** Only a
  planting-level placement propagates `garden_id`, because a batch whose
  specimens sit in different plots is not a thing the rest of the app can
  represent. Moving a specimen across a plot boundary therefore leaves the
  paperwork behind; adjust the planting by hand.
- **A garden-level diary entry cannot be published.** The public policies derive
  publication from the parent planting, so an entry with no planting is
  invisible to anonymous readers. That is the safe default rather than a
  decision — publishing the plot's diary needs its own flag on `observations`.
- **`features_public` is a policy with nothing behind it.** Drawn features are
  readable by anonymous visitors wherever the garden is, but `/julkinen` renders
  no map, so nothing reads them. The policy is there so that adding a public map
  later is a UI change and not a security review.
- **A move is not drawn on the map.** The trail lives on the specimen's page as
  a list. A dashed line from the previous position would double as a sanity
  check on the GPS, and is cheap, but it is not there.
- **Accession codes never renumber.** Quick capture stamps the current year, so
  a record of an older tree whose year is corrected afterwards keeps a code from
  the wrong year. This is deliberate — an accession number is permanent once a
  stake carries it — but it means the year on a corrected draft should be fixed
  before the label is written.
- **XLSX import was declined, not overlooked.** The exporter writes both CSV and
  XLSX; the importer reads CSV only, and the page says so and explains how to
  get a CSV out of Excel. Decided against on 30 July 2026 as not worth the
  round trip.

---

## Layout

```
src/lib/
  basemaps.ts        MML WMTS + OSM sources, degrades without an API key
  data.ts            All PostgREST queries; proximity list assembly
  exporter.ts        CSV by hand, XLSX via lazily-imported ExcelJS
  format.ts          Scientific-name assembly, distances, dates, measurements
  geo.ts             Haversine, bearings, EPSG:3067 ↔ WGS84, world files
  geolocation.svelte.ts   Watched device position
  i18n.ts            Every user-facing string, in Finnish
  mml.ts             Property register lookup by kiinteistötunnus
  photos.ts          Client-side downscale before upload
  supabase.ts        Client + session store
  components/        Plate, SciName, ObservationCard, GrowthChart, MapView, …
  styles/app.css     The design system

supabase/
  migrations/        Schema, triggers, grants, RLS, storage buckets
  seed.sql           Demo arboretum + demo accounts

scripts/
  apply-migrations.sh  Applies each migration once; the migrations are not idempotent
  make-keys.mjs        Generates self-hosting secrets locally; --check verifies an existing .env
```

Routes are Finnish: `/` (field mode), `/kartta`, `/kartta/kohteet`,
`/rekisteri`, `/paivakirja`, `/puutarhat`, `/istutus/[id]`, `/istutus/pika`,
`/puu/[id]`, `/havainto/uusi`, `/raportit`, `/julkinen`, `/asenna`.

### Gardens

One database, not one per garden: separate databases would multiply the hosting
cost and break cross-garden reporting for the sake of a name and a polygon.
`plantings.garden_id` gives the same separation, and every screen scopes itself
to the active garden rather than assuming there is exactly one — so adding a
second plot is a data change, not a rewrite. The picker in the header appears
only once a second garden exists.

Taxa and tags stay global on purpose. *Larix sibirica* is the same species in
every plot, and two parallel tag vocabularies would be miserable to maintain.

Boundaries are drawn by hand on the aerial photo at `/puutarhat` — tap to drop a
corner, drag a corner to adjust — because a rough outline that exists today
beats surveyed data that arrives next year. Area and perimeter are computed
live by projecting to EPSG:3067 first, so the hectares are honest at Finnish
latitudes. `boundary_source` records how the outline was obtained (`drawn` /
`imported` / `survey`) and the UI warns while it is merely drawn, so nobody
mistakes it for a geofence. Replacing it with real survey data later is a swap:
set the new polygon and flip the source.

---

## Design notes

The visual language comes from the subject rather than from a dashboard
template. Two rules do most of the work:

- **A scientific name is always set in Newsreader italic**, with cultivar
  epithets upright in single quotes, exactly as botany sets them. Every screen
  gets this from one component, so it can never drift.
- **Anything measured or counted is set in IBM Plex Mono** — coordinates,
  distances, accession codes, heights, dates. Type does the classifying, which
  lets the surrounding chrome stay quiet.

The one deliberately loud element is the **accession plate**: a planting or a
specimen renders as the dark engraved label a botanical garden stakes next to
the real tree, with the status stripe on the stake edge and the accession
number in the corner. It is the app's signature and the login card is one too.

Palette: birch-bark paper, spruce ink, moss, lichen gold, rowan red. A dark
theme is provided for dusk in the field, and it is a separate set of steps
rather than an inverted light theme. Chart series colours were validated for
colour-vision deficiency and contrast against both chart surfaces; charts carry
direct labels and a table view as the required relief.

---

## Deploying

**[`DEPLOYING.md`](DEPLOYING.md)** is the full walkthrough for self-hosting the
whole stack on a Manjaro (or any Arch-based) server: Supabase in Docker, the SPA
built to static files, nginx in front for HTTPS, backups on a systemd timer.

The short version if you would rather use hosted Supabase and a static host:
`npm run build` emits a static SPA to `build/`. Point `PUBLIC_SUPABASE_URL` and
`PUBLIC_SUPABASE_ANON_KEY` at a Supabase project in an **EU region**, then
`supabase link --project-ref <ref> && supabase db push`.

Either way:

- **Serve it over HTTPS.** Field mode reads the device GPS, and browsers only
  expose geolocation on a secure origin. Plain `http://` to a LAN address looks
  fine on a desktop and then fails in the field.
- **Disable open registration.** Every signed-in account can write to the whole
  register — that is what the RLS policies say — so sign-up must be off and
  accounts created by hand.
- **Do not run `seed.sql` against real data.** It creates demo accounts whose
  passwords are published in this repository.

`npm run db:dump` writes a `pg_dump` to `backup/` for local copies.

---

## Notes for whoever maintains this

- **Grants and RLS are separate gates.** PostgREST needs a table `GRANT` *and* a
  policy. The migration does both; a new table needs both.
- **Auth seeding is fussy.** GoTrue scans `auth.users` token columns into plain
  strings, so seeded users must set `confirmation_token`, `recovery_token`,
  `email_change`, and `email_change_token_new` to `''`, not leave them NULL.
- **Kong caches container IPs.** After `supabase db reset`, if the API answers
  "invalid response from upstream", `docker restart supabase_kong_ArboDB`.
- **Finnish map material is EPSG:3067.** The layer importer detects and
  reprojects it; `src/lib/geo.ts` holds the transverse Mercator maths so no
  proj4 dependency is needed.
- **Do not gate map painting on `map.isStyleLoaded()`.** Inside MapLibre's
  `load` handler it can still report false while sources finish loading, which
  silently skips the first paint with no error. Adding sources and layers there
  is legal; `MapView.repaint()` is the single entry point, re-run on `idle`
  after a basemap swap.
- **Filtering by garden through an embedded resource needs `!inner`.** Plain
  `.eq('plantings.garden_id', id)` keeps every parent row and merely blanks the
  embed, so `fetchObservations` builds its select string with the inner join
  when a garden is given.
