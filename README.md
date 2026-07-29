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

`npm run db:reset` reapplies the migration and reloads the demo data, which is a
realistic 2 ha plot in Uusimaa: 15 taxa, 17 plantings, 20 individually tracked
specimens, 33 observations, and a plot boundary.

### Aerial imagery

The map defaults to the Maanmittauslaitos orthophoto, which needs a free API
key. Register one at
<https://www.maanmittauslaitos.fi/rajapinnat/api-avaimen-ohje> and set
`PUBLIC_MML_API_KEY` in `.env`. Without a key the app falls back to
OpenStreetMap and still shows every imported layer — it just tells you the
aerial view is unavailable.

Vite inlines `PUBLIC_*` variables at build time, so restart `npm run dev` after
editing `.env`.

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

Designed-for-but-not-built, per spec §7: the historical timeline. Every status
change on a planting or a specimen is stamped by a trigger rather than
overwriting, so the history is already accumulating.

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
  photos.ts          Client-side downscale before upload
  supabase.ts        Client + session store
  components/        Plate, SciName, ObservationCard, GrowthChart, MapView, …
  styles/app.css     The design system

supabase/
  migrations/        Schema, triggers, grants, RLS, storage buckets
  seed.sql           Demo arboretum + demo accounts
```

Routes are Finnish: `/` (field mode), `/kartta`, `/rekisteri`, `/istutus/[id]`,
`/puu/[id]`, `/havainto/uusi`, `/raportit`, `/julkinen`.

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

`npm run build` emits a static SPA to `build/` — drop it on Cloudflare Pages or
Vercel free tier. Point `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` at
a hosted Supabase project in an **EU region**, then apply the migration:

```bash
supabase link --project-ref <ref>
supabase db push
```

Do not run `seed.sql` against production — it creates demo accounts with known
passwords. Invite the two real accounts through Supabase Auth instead.

Backups: Supabase's built-in daily backups cover the free tier's retention;
`npm run db:dump` writes a `pg_dump` to `backup/` for keeping your own copies.

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
