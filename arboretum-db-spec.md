# Arboretum Tree Database — Specification

## 1. Overview

A mobile-first web application for managing a private arboretum: a registry of planted trees and woody plants (individuals or groups), field observations with photos, and published reports. Primary user is the arboretum owner; the developer maintains the system. Data volume is small (hundreds of plantings, thousands of observations over years), so the design optimises for simplicity and near-zero running cost, not scale.

**UI language: Finnish.** All user-facing text in Finnish; code, comments, and schema in English. (But potential support for later internationalisation for the UI.)

## 2. Architecture

- **Frontend:** Progressive Web App (installable, mobile-first). Suggested: SvelteKit or React + Vite. Must work well one-handed on a phone in a field.
- **Backend:** Supabase (Postgres + Row Level Security, Storage for photos, Auth). No custom server; use PostgREST/Supabase client directly. Edge Functions only if strictly needed (e.g. weather proxy, report generation).
- **Hosting:** Cloudflare Pages or Vercel (free tier).
- **Map:** MapLibre GL or Leaflet with an open basemap; Finnish aerial imagery (MML ortokuva WMTS, open data) as an optional layer — very useful for positioning trees on a wooded plot.
- **Auth:** Supabase Auth, email magic-link. Two accounts (owner + developer). All write access authenticated; published reports public read-only.
- **Offline:** Not required (good coverage at the site). Standard PWA caching for the app shell is enough; no offline data sync.
- **Speech-to-text:** Not built into the app — plain text fields rely on the phone keyboard's dictation.

## 3. Data model

```
taxa
  id, genus, species, infraspecific_rank, infraspecific_epithet,
  name_fi, mustila_url (nullable), notes

plantings            -- a planted batch (1..n specimens of one taxon)
  id, taxon_id, planted_year, planted_month,
  count_planted, seedling_size_cm,
  propagation text   -- e.g. self-grown from seed, grafted, micropropagated
  provenance text    -- nursery / seed origin / stand origin
  origin_type enum('planted','original')  -- see §7 extension
  status enum('active','removed','dead'), status_changed_at,
  notes

trees                -- optional individual specimens within a planting
  id, planting_id, label,           -- e.g. "A", "B" or field tag number
  lat, lon, position_accuracy_m,
  position_source enum('gps','manual'),
  status enum('alive','dead','removed'), status_changed_at

observations
  id, tree_id (nullable), planting_id,   -- observation targets an
                                          -- individual OR the whole batch
  observed_at timestamptz,
  kind enum('growth','care','damage','phenology','other'),
  height_cm (nullable), diameter_mm (nullable),
  body text

tags                 -- user-managed vocabulary
  id, name, color

observation_tags     -- many-to-many; THIS is what makes
  observation_id, tag_id               -- reclassification trivial

photos
  id, observation_id (nullable), tree_id (nullable), planting_id (nullable),
  storage_path, taken_at, caption
```

Design notes:

- A planting may have zero individually tracked trees (batch of 20 seedlings) or several; observations can attach to either level. Individuals can be split out from a batch later.
- Classification is done with tags on observations, never a fixed category column (apart from the coarse `kind`), so the owner can create, rename, merge, and reassign tags at any time. Provide a tag management screen with bulk retagging.
- Positions live on `trees`. For batch plantings without individuals, allow an optional area/centroid position on `plantings` (lat, lon, radius_m).
- Photos go to Supabase Storage; generate thumbnails (client-side resize before upload to keep storage small — target ≤ ~300 KB per photo plus a thumbnail).

## 4. Core user flows

### 4.1 Field mode ("Olen puun vieressä")
1. Open app → app reads device GPS.
2. Show a list of nearest trees/plantings sorted by distance ("Lehtikuusi A — 6 m"), plus a small map centred on the user.
3. User taps the right one → detail card: taxon (scientific + Finnish name), planting data, latest observations, photos, link to Mustila page if set.
4. One-tap "Uusi havainto": kind, free text, optional measurements, tags, camera capture (multiple photos). Save fetches and stores a weather snapshot (§6).

### 4.2 Positioning and correction
- New tree: capture GPS position with accuracy reading; mark `position_source='gps'`.
- Map view (also on desktop): all trees as draggable markers over the basemap/aerial layer; dragging sets `position_source='manual'`. This is the tool for fixing GPS scatter.

### 4.3 Registry management (desktop-friendly)
- CRUD for taxa, plantings, trees, tags.
- Import: one-off CSV import of existing records (planting year_month like `2017_05`, genus, species+infraspecific, Finnish name, count, size+description, provenance).
- Export: CSV and XLSX of any table/filtered view — this covers the Word/Excel editing wish; no live two-way sync with Office.

### 4.4 Reports and publishing
- Report views: planting registry table, observations per tree/taxon/tag/date range, growth series (height over time) as simple charts, photo galleries.
- Print-friendly CSS for paper output.
- Publishing: selected reports rendered to a public, read-only site section (same app, public routes reading via anon key + RLS policies that expose only rows flagged `published`). Owner marks plantings/reports as published.

## 5. External tree databases

No public APIs exist for Finnish arboretum databases (e.g. Mustila); integration is an outbound link per taxon (`mustila_url`), plus optionally Dendrologian Seura / GBIF taxon links. Keep it a simple nullable URL field — do not scrape.

## 6. Weather integration

- Weather data at the moment of observation is not necessary for MVP, but some kind of average weather data might be pulled in later.

## 7. Extension (design for, do not build yet)

Historical record of the plot's original tree species and their changes 2000 → present: covered by `origin_type='original'` on plantings plus `status`/`status_changed_at` on plantings and trees. Ensure status changes are timestamped rather than destructive so a timeline view can be added later.

## 8. Non-functional requirements

- Cost ceiling: a few €/month. Expect Supabase free tier to suffice for years; photo storage is the only growth axis.
- Single-region EU hosting for the database (Supabase EU region).
- Backups: nightly `pg_dump` via scheduled job or Supabase's built-in backups; photos bucket versioning optional.
- Simple to maintain: minimal dependencies, no custom server processes, migrations in SQL files under version control.

## 9. Assumptions to confirm with the owner

1. Finnish-only UI is sufficient (no bilingual requirement).
2. Two user accounts are enough; no public data entry.
3. Published reports may be openly visible on the internet (no login).
4. Photo originals may be downscaled on upload (no need to archive full-resolution files in the app — owner keeps originals on his phone/computer if wanted).

## 10. Suggested build order

1. Schema + Supabase project + auth + RLS.
2. Registry CRUD + CSV import of existing data.
3. Field mode: proximity list, detail card, observation entry with photos.
4. Map view with draggable position correction (+ aerial layer).
5. Tags and bulk retagging.
6. ~Weather snapshot on save.~
7. Reports, exports, print CSS.
8. Public publishing routes.
