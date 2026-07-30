-- Demo content for local development: a plausible 2.3 ha arboretum on a wooded
-- plot in Western Uusimaa, planted from 2004 onwards, with a handful of trees
-- that predate the arboretum (origin_type = 'original').
--
-- The boundary is the outline traced by hand over the aerial photo of the real
-- MVP plot, near 60.09336 N, 23.02110 E. Every specimen sits inside it with at
-- least 6 m to spare, so the map opens on a plot that looks like the real one.
-- Replace the specimens with the owner's real data via the CSV import once his
-- list arrives; the boundary is already his.

-- ------------------------------------------------------------- accounts ----

-- The token columns are declared nullable but GoTrue scans them into plain
-- strings, so a NULL there makes every sign-in fail with "Database error
-- querying schema". They must be seeded as empty strings, not left out.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'omistaja@arbodb.test',
   crypt('arbodb-demo', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Omistaja"}',
   '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'yllapito@arbodb.test',
   crypt('arbodb-demo', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{"name":"Ylläpito"}',
   '', '', '', '')
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id, id, id::text,
       format('{"sub":"%s","email":"%s","email_verified":true}', id, email)::jsonb,
       'email', now(), now(), now()
  from auth.users
 where email in ('omistaja@arbodb.test', 'yllapito@arbodb.test')
on conflict do nothing;

-- -------------------------------------------------------------- gardens ----
-- One plot, outlined by hand over the aerial photo of the real MVP site.
-- Flagged 'drawn' — it stands in for survey data, and the UI says so.

insert into gardens (id, name, notes, center_lat, center_lon, default_zoom, boundary, boundary_source, sort_order)
values (
  '90000000-0000-4000-8000-000000000001',
  'Torppa',
  'Tontti Länsi-Uudellamaalla, 2,32 ha. Raja piirretty käsin ilmakuvan päälle — korvataan mittausaineistolla kun se saadaan.',
  60.093363, 23.021098, 17,
  '{"type":"Polygon","coordinates":[[[23.022728,60.092751],[23.023249,60.093631],[23.019377,60.094038],[23.019151,60.093506],[23.019342,60.093204],[23.019467,60.092965],[23.02146,60.092807],[23.022728,60.092751]]]}'::jsonb,
  'drawn', 0
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------- taxa ----

insert into taxa (id, genus, species, infraspecific_rank, infraspecific_epithet, cultivar, name_fi, mustila_url, notes) values
  ('a0000000-0000-4000-8000-000000000001', 'Larix',      'sibirica',    null,     null,        null,         'siperianlehtikuusi', 'https://www.mustila.fi/kasvit/larix-sibirica', 'Nopeakasvuinen, vaatii täyden auringon.'),
  ('a0000000-0000-4000-8000-000000000002', 'Abies',      'koreana',     null,     null,        null,         'koreanpihta',        'https://www.mustila.fi/kasvit/abies-koreana', 'Käpyilee nuorena.'),
  ('a0000000-0000-4000-8000-000000000003', 'Acer',       'platanoides', null,     null,        'Royal Red',  'metsävaahtera',      null, 'Punalehtinen lajike, varjostettu kasvupaikka.'),
  ('a0000000-0000-4000-8000-000000000004', 'Quercus',    'robur',       null,     null,        null,         'metsätammi',         'https://www.mustila.fi/kasvit/quercus-robur', null),
  ('a0000000-0000-4000-8000-000000000005', 'Betula',     'pendula',     'var.',   'carelica',  null,         'visakoivu',          null, 'Alkuperäinen kanta tontin pohjoisreunassa.'),
  ('a0000000-0000-4000-8000-000000000006', 'Picea',      'abies',       null,     null,        null,         'metsäkuusi',         null, 'Tontin alkuperäistä puustoa.'),
  ('a0000000-0000-4000-8000-000000000007', 'Pinus',      'sylvestris',  null,     null,        null,         'metsämänty',         null, 'Tontin alkuperäistä puustoa.'),
  ('a0000000-0000-4000-8000-000000000008', 'Tilia',      'cordata',     null,     null,        null,         'metsälehmus',        null, null),
  ('a0000000-0000-4000-8000-000000000009', 'Magnolia',   'kobus',       null,     null,        null,         'aitokobuksenmagnolia', 'https://www.mustila.fi/kasvit/magnolia-kobus', 'Kestävyys rajoilla, suojaisa paikka.'),
  ('a0000000-0000-4000-8000-00000000000a', 'Rhododendron', null,        null,     null,        'Haaga',      'alppiruusu',         'https://www.mustila.fi/kasvit/rhododendron-haaga', 'Mustilan jalostama Marjatta-hybridi.'),
  ('a0000000-0000-4000-8000-00000000000b', 'Sorbus',     'aucuparia',   null,     null,        null,         'kotipihlaja',        null, null),
  ('a0000000-0000-4000-8000-00000000000c', 'Fraxinus',   'excelsior',   null,     null,        null,         'lehtosaarni',        null, 'Saarnensurma seurannassa.'),
  ('a0000000-0000-4000-8000-00000000000d', 'Thuja',      'occidentalis', null,    null,        'Brabant',    'kanadantuija',       null, null),
  ('a0000000-0000-4000-8000-00000000000e', 'Juglans',    'ailantifolia', null,    null,        null,         'japaninjalopähkinä', null, 'Kokeilu, talvivauriot kirjattava.'),
  ('a0000000-0000-4000-8000-00000000000f', 'Ulmus',      'glabra',      null,     null,        null,         'vuorijalava',        null, null)
on conflict (id) do nothing;

-- ------------------------------------------------------------ plantings ----

insert into plantings (id, garden_id, taxon_id, accession_code, planted_year, planted_month, count_planted, seedling_size_cm,
                       propagation, provenance, origin_type, status, lat, lon, radius_m, published, notes) values
  ('b0000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', '2004-001', 2004,  5, 12,  40, 'siemenestä itse kasvatettu', 'Siemen: Punkaharju, MTT', 'planted', 'active', 60.093693, 23.020132, 10, true,  'Rivistö tontin eteläreunassa, 3 m välein.'),
  ('b0000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '2009-001', 2009,  6,  3,  60, 'taimitarhataimi',           'Taimisto Rönnvik, Inkoo',  'planted', 'active', 60.093304, 23.021048,  3, true,  null),
  ('b0000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', '2012-001', 2012,  9,  1, 180, 'vartettu',                  'Taimisto Rönnvik, Inkoo',  'planted', 'active', 60.093122, 23.021769,  2, true,  'Näyttöpuu nurmikentän reunassa.'),
  ('b0000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', '2012-002', 2012,  5,  6,  30, 'siemenestä itse kasvatettu', 'Siemen: Ruissalo, Turku',  'planted', 'active', 60.093238, 23.020291, 6, true,  'Kaksi kuollut kuivuuteen 2018.'),
  ('b0000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', '2015-001', 2015,  5,  8,  50, 'siemenestä itse kasvatettu', 'Siemen: oma kanta',        'planted', 'active', 60.093594, 23.021606, 8, true,  null),
  ('b0000000-0000-4000-8000-000000000006', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000008', '2016-001', 2016,  6,  4,  90, 'taimitarhataimi',           'Viherpiha Oy, Vantaa',     'planted', 'active', 60.093251, 23.022199, 4,  true,  'Tulevan lehmuskujan alku.'),
  ('b0000000-0000-4000-8000-000000000007', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000009', '2017-001', 2017,  5,  1,  70, 'mikrolisätty',              'Arboretum Mustila',        'planted', 'active', 60.093570, 23.019691, 2,  true,  'Suojaisa paikka kuusiaidan takana.'),
  ('b0000000-0000-4000-8000-000000000008', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a', '2017-002', 2017,  8,  9,  35, 'pistokkaista',              'Arboretum Mustila',        'planted', 'active', 60.093381, 23.019831, 4,  true,  'Happaman maan ryhmä, katteena kuorihake.'),
  ('b0000000-0000-4000-8000-000000000009', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000b', '2018-001', 2018,  5,  5,  60, 'siemenestä itse kasvatettu', 'Siemen: tontin oma pihlaja','planted','active', 60.093793, 23.020851, 5, false, null),
  ('b0000000-0000-4000-8000-00000000000a', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000c', '2019-001', 2019,  9,  3, 120, 'taimitarhataimi',           'Taimisto Rönnvik, Inkoo',  'planted', 'active', 60.093276, 23.022580, 3,  false, 'Seurataan saarnensurman oireita.'),
  ('b0000000-0000-4000-8000-00000000000b', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000d', '2020-001', 2020,  5, 20,  45, 'taimitarhataimi',           'Viherpiha Oy, Vantaa',     'planted', 'active', 60.093017, 23.021105, 12, false, 'Suojaistutus länsirajalla.'),
  ('b0000000-0000-4000-8000-00000000000c', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000e', '2021-001', 2021,  6,  2,  55, 'siemenestä itse kasvatettu', 'Siemen: GBIF-vaihto, Sapporo','planted','active', 60.093024, 23.022717, 2, false, 'Kokeiluistutus, talvisuojaus ensimmäiset vuodet.'),
  ('b0000000-0000-4000-8000-00000000000d', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000f', '2022-001', 2022,  5,  2, 100, 'taimitarhataimi',           'Taimisto Rönnvik, Inkoo',  'planted', 'active', 60.093463, 23.022183, 2,  false, null),
  ('b0000000-0000-4000-8000-00000000000e', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', '2023-001', 2023,  5,  4,  25, 'siemenestä itse kasvatettu', 'Siemen: oma kanta 2009-001','planted','active', 60.093358, 23.020803, 3, false, 'Toinen sukupolvi omista siemenistä.'),
  -- Original stand predating the arboretum (spec section 7).
  ('b0000000-0000-4000-8000-00000000000f', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', '2000-001', 2000, null, 40, null, null, 'Tontin alkuperäinen kuusikko', 'original', 'active', 60.093556, 23.022678, 22, false, 'Pohjoisrinteen varttunut kuusikko, harvennettu 2011 ja 2019.'),
  ('b0000000-0000-4000-8000-000000000010', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000007', '2000-002', 2000, null, 15, null, null, 'Tontin alkuperäinen männikkö', 'original', 'active', 60.093253, 23.019424, 13, false, 'Kalliomännikkö lounaiskulmassa.'),
  ('b0000000-0000-4000-8000-000000000011', '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', '2000-003', 2000, null,  8, null, null, 'Tontin alkuperäinen kuusikko', 'original', 'removed', 60.093371, 23.021687, 6, false, 'Poistettu 2016 arboretumin nurmikentän tieltä.')
on conflict (id) do nothing;

update plantings set status_changed_at = '2016-04-18T00:00:00+03' where id = 'b0000000-0000-4000-8000-000000000011';

-- ---------------------------------------------------------------- trees ----
-- Individually tracked specimens. Batch plantings without individuals rely on
-- the planting's own centroid instead.

insert into trees (id, planting_id, label, lat, lon, position_accuracy_m, position_source, status, notes) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'A', 60.093696, 23.019973, 3.5, 'gps',    'alive',   'Rivin läntisin, paras runko.'),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'B', 60.093693, 23.020088, 4.0, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'C', 60.093684, 23.020215, 2.5, 'manual', 'alive',   'Kaksihaarainen latva, korjattu 2019.'),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'D', 60.093677, 23.020341, 3.0, 'manual', 'dead',    'Kuollut 2021, myrskyvaurio.'),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', 'A', 60.093303, 23.021025, 2.8, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002', 'B', 60.093306, 23.021078, 3.2, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000002', 'C', 60.093326, 23.020988, 5.0, 'gps',    'alive',   'Heikoin kolmesta, varjossa.'),
  ('c0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003', null, 60.093122, 23.021769, 2.0, 'manual', 'alive',  null),
  ('c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000004', 'A', 60.093256, 23.020230, 4.5, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000004', 'B', 60.093231, 23.020324, 4.5, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000004', 'C', 60.093212, 23.020407, 6.0, 'gps',    'dead',    'Kuivuus 2018.'),
  ('c0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000004', 'D', 60.093226, 23.020459, 6.0, 'gps',    'dead',    'Kuivuus 2018.'),
  ('c0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000007', null, 60.093570, 23.019691, 2.2, 'manual', 'alive',  'Mitataan joka kevät.'),
  ('c0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-00000000000c', 'A', 60.093024, 23.022717, 3.8, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-00000000000c', 'B', 60.093010, 23.022752, 3.8, 'gps',    'removed', 'Siirretty kasvihuoneelle 2023.'),
  ('c0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000006', 'A', 60.093255, 23.022172, 3.0, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000006', 'B', 60.093259, 23.022233, 3.0, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-00000000000a', 'A', 60.093276, 23.022580, 2.6, 'manual', 'alive',   'Latvakato lievä 2024.'),
  ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-00000000000d', 'A', 60.093463, 23.022183, 3.1, 'gps',    'alive',   null),
  ('c0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-00000000000f', 'V1', 60.093559, 23.022716, 5.0, 'manual', 'alive',  'Rinteen suurin kuusi, rungon ympärys 1,9 m.')
on conflict (id) do nothing;

update trees set status_changed_at = '2021-11-02T00:00:00+02' where id = 'c0000000-0000-4000-8000-000000000004';
update trees set status_changed_at = '2018-08-11T00:00:00+03' where id in ('c0000000-0000-4000-8000-00000000000b','c0000000-0000-4000-8000-00000000000c');
update trees set status_changed_at = '2023-06-04T00:00:00+03' where id = 'c0000000-0000-4000-8000-00000000000f';

-- ----------------------------------------------------------------- tags ----

insert into tags (id, name, color) values
  ('d0000000-0000-4000-8000-000000000001', 'talvivaurio',   '#7A9CC6'),
  ('d0000000-0000-4000-8000-000000000002', 'myyrätuho',     '#9A6A4A'),
  ('d0000000-0000-4000-8000-000000000003', 'kukinta',       '#C4739A'),
  ('d0000000-0000-4000-8000-000000000004', 'kävyt',         '#7E6A9C'),
  ('d0000000-0000-4000-8000-000000000005', 'lannoitus',     '#4E7A4A'),
  ('d0000000-0000-4000-8000-000000000006', 'leikkaus',      '#5C7C88'),
  ('d0000000-0000-4000-8000-000000000007', 'kastelu',       '#4B8FA6'),
  ('d0000000-0000-4000-8000-000000000008', 'hirvituho',     '#A2543C'),
  ('d0000000-0000-4000-8000-000000000009', 'mittaus',       '#3F6B52'),
  ('d0000000-0000-4000-8000-00000000000a', 'kuivuus',       '#B08A3E'),
  ('d0000000-0000-4000-8000-00000000000b', 'syysväri',      '#C06A2E'),
  ('d0000000-0000-4000-8000-00000000000c', 'seurannassa',   '#6E6A5E')
on conflict (id) do nothing;

-- --------------------------------------------------------- observations ----
-- Growth series on a few specimens plus scattered care and damage notes, so the
-- charts and the tag filters have something real to chew on.

insert into observations (id, planting_id, tree_id, observed_at, kind, height_cm, diameter_mm, body) values
  -- Larix 2004-001, tree A: 20 years of height measurements
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2010-09-12T14:00:00+03', 'growth',  310,  45, 'Kevätkasvu hyvä, latva suora.'),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2014-09-20T13:30:00+03', 'growth',  620,  92, null),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2018-09-15T12:00:00+03', 'growth',  980, 148, 'Kuiva kesä näkyy vuosikasvussa.'),
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2021-09-18T11:00:00+03', 'growth', 1210, 186, null),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2024-09-21T11:15:00+03', 'growth', 1470, 228, 'Mitattu laserilla, runko terve.'),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', '2019-06-02T10:00:00+03', 'care',    null, null, 'Kaksoislatva poistettu, jäljelle jätetty vahvempi haara.'),
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', '2021-11-02T09:00:00+02', 'damage',  null, null, 'Kaatunut syysmyrskyssä, runko katkennut 2 m korkeudelta. Merkitty kuolleeksi.'),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000001',  null,                                   '2023-05-14T16:00:00+03', 'care',    null, null, 'Koko rivistön aluskasvillisuus niitetty, kate lisätty.'),

  -- Abies koreana 2009-001
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', '2016-05-22T15:00:00+03', 'phenology', 145, null, 'Ensimmäiset kävyt, siniset ja pystyt.'),
  ('e0000000-0000-4000-8000-00000000000a', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', '2020-09-05T14:00:00+03', 'growth',    215,  62, null),
  ('e0000000-0000-4000-8000-00000000000b', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000005', '2025-05-30T10:30:00+03', 'growth',    295,  88, 'Runsas käpysato, kerätty siemeniä.'),
  ('e0000000-0000-4000-8000-00000000000c', 'b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000007', '2022-04-10T11:00:00+03', 'damage',   null, null, 'Neulaset ruskettuneet etelänpuoleiselta sivulta, kevätahava.'),

  -- Acer 'Royal Red'
  ('e0000000-0000-4000-8000-00000000000d', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000008', '2018-10-04T15:30:00+03', 'phenology', null, null, 'Syysväri poikkeuksellisen kirkas, tummanpunaisesta oranssiin.'),
  ('e0000000-0000-4000-8000-00000000000e', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000008', '2021-06-15T09:00:00+03', 'care',      null, null, 'Nostoleikkaus, alaoksat poistettu 2,2 m asti.'),
  ('e0000000-0000-4000-8000-00000000000f', 'b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000008', '2024-09-28T14:00:00+03', 'growth',     640, 165, null),

  -- Quercus robur batch
  ('e0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000004',  null,                                   '2018-08-11T17:00:00+03', 'damage',    null, null, 'Pitkä kuivuusjakso: kaksi tainta kuivunut, loput kastelussa.'),
  ('e0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000009', '2022-09-12T13:00:00+03', 'growth',     420, 78, null),
  ('e0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000009', '2025-09-14T13:20:00+03', 'growth',     560, 104, 'Terve, hyvä latvus.'),

  -- Magnolia kobus — the fussy one
  ('e0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-00000000000d', '2019-03-30T12:00:00+03', 'damage',    null, null, 'Kukkasilmut paleltuneet maaliskuun pakkasjakson jäljiltä.'),
  ('e0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-00000000000d', '2022-05-08T11:00:00+03', 'phenology', null, null, 'Ensimmäinen kunnollinen kukinta, n. 30 kukkaa.'),
  ('e0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-00000000000d', '2025-05-06T10:00:00+03', 'phenology', 245,  38, 'Täysi kukinta 6.5. — aikaisin tähänastisista.'),

  -- Rhododendron group
  ('e0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000008',  null,                                   '2021-06-12T16:00:00+03', 'phenology', null, null, 'Ryhmä kukassa, väri vaaleanpunainen. Kaksi tainta jäljessä muista.'),
  ('e0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000008',  null,                                   '2023-04-22T14:00:00+03', 'care',      null, null, 'Havukate uusittu, rautalannoite annettu.'),
  ('e0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000008',  null,                                   '2025-06-08T15:00:00+03', 'phenology', null, null, 'Paras kukinta tähän mennessä, kaikki 9 kukkivat.'),

  -- Fraxinus under watch
  ('e0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000012', '2024-08-19T13:00:00+03', 'damage',    null, null, 'Latvuksen yläosassa kuivia oksia n. 15 %. Saarnensurma mahdollinen — seurataan.'),
  ('e0000000-0000-4000-8000-00000000001a', 'b0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-000000000012', '2025-08-20T13:00:00+03', 'damage',    null, null, 'Kuivien oksien osuus ennallaan, ei etenemistä.'),

  -- Juglans experiment
  ('e0000000-0000-4000-8000-00000000001b', 'b0000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000e', '2022-04-28T12:00:00+03', 'damage',    null, null, 'Latvakasvain paleltunut, uusi versoo sivusilmusta.'),
  ('e0000000-0000-4000-8000-00000000001c', 'b0000000-0000-4000-8000-00000000000c', 'c0000000-0000-4000-8000-00000000000e', '2025-07-02T11:00:00+03', 'growth',     185,  34, 'Selvinnyt kolme talvea ilman suojausta.'),

  -- Thuja hedge, myyrä damage
  ('e0000000-0000-4000-8000-00000000001d', 'b0000000-0000-4000-8000-00000000000b',  null,                                   '2023-04-05T10:00:00+03', 'damage',    null, null, 'Myyrät kaluneet neljän taimen tyviä lumen alla. Verkot asennettu lopuille.'),

  -- Original spruce stand
  ('e0000000-0000-4000-8000-00000000001e', 'b0000000-0000-4000-8000-00000000000f', 'c0000000-0000-4000-8000-000000000014', '2019-11-10T12:00:00+02', 'care',      null, null, 'Rinteen kuusikko harvennettu toisen kerran, poistettu 12 runkoa.'),
  ('e0000000-0000-4000-8000-00000000001f', 'b0000000-0000-4000-8000-00000000000f', 'c0000000-0000-4000-8000-000000000014', '2025-06-18T12:00:00+03', 'growth',    2650, 610, 'Ympärysmitta 1,92 m rinnankorkeudelta.'),

  -- Tilia avenue
  ('e0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000006',  null,                                   '2024-05-02T09:00:00+03', 'care',      null, null, 'Kaikki neljä lannoitettu, tukikepit poistettu.'),
  ('e0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000010', '2025-09-03T14:00:00+03', 'growth',     480,  96, null)
on conflict (id) do nothing;

-- ------------------------------------------------------ diary entries ----
-- Entries about the plot rather than about any one planting: the half of an
-- arboretum's year that a per-tree log has nowhere to put. Two are pinned to a
-- spot on the ground, the rest are about the place as a whole.

insert into observations
  (id, garden_id, planting_id, tree_id, observed_at, kind, body, lat, lon, radius_m)
values
  ('e0000000-0000-4000-8000-000000000031', '90000000-0000-4000-8000-000000000001', null, null,
   '2024-03-08T11:00:00+02', 'care',
   'Luonnonmetsää harvennettu pohjoisreunalta: poistettu pienikokoista kuusta noin kolmen aarin alalta, jätetty koivut kasvamaan.',
   60.09412, 23.01978, 30),
  ('e0000000-0000-4000-8000-000000000032', '90000000-0000-4000-8000-000000000001', null, null,
   '2024-07-19T20:30:00+03', 'weather',
   'Ukkoskuuro, mittarissa 41 mm vuorokaudessa. Alarinteen oja tulvi yli.',
   null, null, null),
  ('e0000000-0000-4000-8000-000000000033', '90000000-0000-4000-8000-000000000001', null, null,
   '2024-08-02T09:15:00+03', 'damage',
   'Riista-aidan eteläpää painunut hirven törmäyksestä, verkko revennyt noin kahden metrin matkalta.',
   60.09298, 23.02071, 5),
  ('e0000000-0000-4000-8000-000000000034', '90000000-0000-4000-8000-000000000001', null, null,
   '2025-05-24T13:00:00+03', 'care',
   'Nurmikkoalue laajennettu magnolian ympäriltä pohjoiseen, kivet siirretty kiviaidan jatkeeksi.',
   null, null, null),
  ('e0000000-0000-4000-8000-000000000035', '90000000-0000-4000-8000-000000000001', null, null,
   '2026-02-11T10:00:00+02', 'weather',
   'Leuto talvi, lunta korkeintaan 15 cm koko kaudella. Routa ei kantanut konetta harvennukselle.',
   null, null, null)
on conflict (id) do nothing;

-- --------------------------------------------------------- observation_tags --

insert into observation_tags (observation_id, tag_id) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-00000000000a'),
  ('e0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-00000000000a', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000004'),
  ('e0000000-0000-4000-8000-00000000000b', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-00000000000c', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-00000000000d', 'd0000000-0000-4000-8000-00000000000b'),
  ('e0000000-0000-4000-8000-00000000000e', 'd0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-00000000000f', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-00000000000a'),
  ('e0000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000007'),
  ('e0000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000013', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-000000000014', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000015', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000016', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000017', 'd0000000-0000-4000-8000-000000000005'),
  ('e0000000-0000-4000-8000-000000000018', 'd0000000-0000-4000-8000-000000000003'),
  ('e0000000-0000-4000-8000-000000000019', 'd0000000-0000-4000-8000-00000000000c'),
  ('e0000000-0000-4000-8000-00000000001a', 'd0000000-0000-4000-8000-00000000000c'),
  ('e0000000-0000-4000-8000-00000000001b', 'd0000000-0000-4000-8000-000000000001'),
  ('e0000000-0000-4000-8000-00000000001c', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-00000000001d', 'd0000000-0000-4000-8000-000000000002'),
  ('e0000000-0000-4000-8000-00000000001e', 'd0000000-0000-4000-8000-000000000006'),
  ('e0000000-0000-4000-8000-00000000001f', 'd0000000-0000-4000-8000-000000000009'),
  ('e0000000-0000-4000-8000-000000000020', 'd0000000-0000-4000-8000-000000000005'),
  ('e0000000-0000-4000-8000-000000000021', 'd0000000-0000-4000-8000-000000000009')
on conflict do nothing;

-- ------------------------------------------------------- map features ----
-- What the aerial photograph cannot show: the paths under the canopy, the
-- stone wall, the game fence, the mown ground. All invented, like the
-- plantings, but drawn where they would plausibly run on the real plot.

insert into features (id, garden_id, name, kind, geometry, notes, sort_order) values
  ('f1000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
   'Pääpolku', 'path',
   '{"type":"LineString","coordinates":[[23.019665,60.093332],[23.021241,60.093380],[23.022816,60.093428]]}'::jsonb,
   'Kuljettu polku lehtikuusirivin ja tammien välissä.', 0),
  ('f1000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001',
   'Vanha kiviaita', 'wall',
   '{"type":"LineString","coordinates":[[23.019420,60.093690],[23.020560,60.093720],[23.021900,60.093700]]}'::jsonb,
   'Peltojen vanha raja, osin sortunut itäpäästä.', 1),
  ('f1000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001',
   'Riista-aita', 'fence',
   '{"type":"LineString","coordinates":[[23.019300,60.093020],[23.021500,60.093050],[23.023100,60.093180]]}'::jsonb,
   'Hirviaita eteläreunalla.', 2),
  ('f1000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001',
   'Nurmikko', 'lawn',
   '{"type":"Polygon","coordinates":[[[23.020200,60.093400],[23.021100,60.093410],[23.021150,60.093620],[23.020240,60.093610],[23.020200,60.093400]]]}'::jsonb,
   'Niitetty alue magnolian ympärillä.', 3)
on conflict (id) do nothing;
