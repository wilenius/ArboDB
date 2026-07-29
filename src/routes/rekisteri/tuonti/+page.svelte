<script lang="ts">
	import Papa from 'papaparse';
	import { fetchObservations, fetchPlantings, fetchTaxa } from '$lib/data';
	import { supabase, session } from '$lib/supabase';
	import { downloadCsv, downloadXlsx, stamped, type Column } from '$lib/exporter';
	import { formatDateTime, formatMeasurement, scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Observation, Planting, Taxon } from '$lib/types';

	// --- import ------------------------------------------------------------

	/**
	 * The owner's existing list is a spreadsheet, one row per planted batch. The
	 * importer maps its columns onto taxa + plantings, creating a taxon the first
	 * time a name appears and reusing it after that. Header names are guessed but
	 * always shown for correction — a silent mis-map would be worse than none.
	 */

	const FIELDS = [
		{ key: 'year_month', label: 'Istutusaika (2017_05)' },
		{ key: 'genus', label: t.taxon.genus },
		{ key: 'species', label: 'Laji ja alataso' },
		{ key: 'name_fi', label: t.taxon.nameFi },
		{ key: 'count', label: t.planting.count },
		{ key: 'size', label: 'Koko ja kuvaus' },
		{ key: 'provenance', label: t.planting.provenance },
		{ key: 'notes', label: t.planting.notes }
	] as const;

	const GUESSES: Record<string, string[]> = {
		year_month: ['year_month', 'aika', 'istutus', 'vuosi', 'pvm', 'date'],
		genus: ['genus', 'suku'],
		species: ['species', 'laji', 'epithet'],
		name_fi: ['name_fi', 'suomi', 'suomalainen', 'suomenkielinen', 'nimi'],
		count: ['count', 'kpl', 'lukum', 'määrä', 'maara'],
		size: ['size', 'koko', 'taimi', 'kuvaus'],
		provenance: ['provenance', 'alkuper', 'siemen', 'taimisto'],
		notes: ['notes', 'huom', 'muistiinpano', 'lisätieto']
	};

	let rows = $state<Record<string, string>[]>([]);
	let headers = $state<string[]>([]);
	let mapping = $state<Record<string, string>>({});
	let importing = $state(false);
	let importDone = $state('');
	let importErrors = $state<string[]>([]);

	function onFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importDone = '';
		importErrors = [];
		Papa.parse<Record<string, string>>(file, {
			header: true,
			skipEmptyLines: true,
			delimiter: '',
			complete: (result) => {
				rows = result.data;
				headers = result.meta.fields ?? [];
				const guessed: Record<string, string> = {};
				for (const field of FIELDS) {
					const hit = headers.find((h) =>
						GUESSES[field.key].some((g) => h.toLowerCase().includes(g))
					);
					if (hit) guessed[field.key] = hit;
				}
				mapping = guessed;
			}
		});
	}

	const cell = (row: Record<string, string>, key: string) =>
		(mapping[key] ? (row[mapping[key]] ?? '') : '').trim();

	/** "2017_05", "2017-05", "5/2017" and a bare year all mean something. */
	function parseYearMonth(raw: string): { year: number | null; month: number | null } {
		const nums = raw.match(/\d+/g)?.map(Number) ?? [];
		const year = nums.find((n) => n >= 1800 && n <= 2100) ?? null;
		const month = nums.find((n) => n >= 1 && n <= 12 && n !== year) ?? null;
		return { year, month };
	}

	/** "sibirica var. rossica" → species plus infraspecific rank and epithet. */
	function parseSpecies(raw: string) {
		const parts = raw.trim().split(/\s+/).filter(Boolean);
		const rankIndex = parts.findIndex((p) => /^(var\.?|subsp\.?|ssp\.?|f\.)$/i.test(p));
		if (rankIndex === -1) {
			return { species: parts[0] ?? null, rank: null, epithet: null };
		}
		return {
			species: parts.slice(0, rankIndex).join(' ') || null,
			rank: parts[rankIndex],
			epithet: parts.slice(rankIndex + 1).join(' ') || null
		};
	}

	const preview = $derived(rows.slice(0, 8));

	async function runImport() {
		importing = true;
		importErrors = [];
		let created = 0;

		try {
			const existing = await fetchTaxa();
			const index = new Map(
				existing.map((x) => [scientificName(x).toLowerCase(), x.id] as const)
			);

			for (const [i, row] of rows.entries()) {
				const genus = cell(row, 'genus');
				if (!genus) {
					importErrors.push(`Rivi ${i + 2}: suku puuttuu`);
					continue;
				}
				const { species, rank, epithet } = parseSpecies(cell(row, 'species'));
				const key = [genus, species, rank, epithet].filter(Boolean).join(' ').toLowerCase();

				let taxonId = index.get(key);
				if (!taxonId) {
					const { data, error } = await supabase
						.from('taxa')
						.insert({
							genus,
							species,
							infraspecific_rank: rank,
							infraspecific_epithet: epithet,
							name_fi: cell(row, 'name_fi') || null
						})
						.select('id')
						.single();
					if (error) {
						importErrors.push(`Rivi ${i + 2}: ${t.errors.save}`);
						continue;
					}
					const createdId: string = data.id;
					taxonId = createdId;
					index.set(key, createdId);
				}

				const { year, month } = parseYearMonth(cell(row, 'year_month'));
				const size = cell(row, 'size');
				const sizeNum = size.match(/\d+/)?.[0];

				const { error } = await supabase.from('plantings').insert({
					taxon_id: taxonId,
					planted_year: year,
					planted_month: month,
					count_planted: Number(cell(row, 'count').replace(/\D/g, '')) || 1,
					seedling_size_cm: sizeNum ? Number(sizeNum) : null,
					// The size column often carries a description too; keep the words.
					propagation: /\d+\s*cm?$/.test(size) ? null : size || null,
					provenance: cell(row, 'provenance') || null,
					notes: cell(row, 'notes') || null
				});
				if (error) importErrors.push(`Rivi ${i + 2}: ${t.errors.save}`);
				else created++;
			}

			importDone = t.importer.done(created);
			rows = [];
			headers = [];
		} finally {
			importing = false;
		}
	}

	// --- export ------------------------------------------------------------

	let exportWhat = $state<'plantings' | 'trees' | 'taxa' | 'observations'>('plantings');
	let exporting = $state(false);

	const PLANTING_COLUMNS: Column<Planting>[] = [
		{ key: 'accession', header: 'Tunnus', value: (p) => p.accession_code },
		{ key: 'sci', header: 'Tieteellinen nimi', value: (p) => scientificName(p.taxa) },
		{ key: 'fi', header: 'Suomenkielinen nimi', value: (p) => p.taxa?.name_fi },
		{ key: 'year', header: 'Istutusvuosi', value: (p) => p.planted_year },
		{ key: 'month', header: 'Kuukausi', value: (p) => p.planted_month },
		{ key: 'count', header: 'Kpl', value: (p) => p.count_planted },
		{ key: 'size', header: 'Taimen koko (cm)', value: (p) => p.seedling_size_cm },
		{ key: 'propagation', header: 'Lisäystapa', value: (p) => p.propagation },
		{ key: 'provenance', header: 'Alkuperä', value: (p) => p.provenance },
		{ key: 'origin', header: 'Tyyppi', value: (p) => t.enums.originType[p.origin_type] },
		{ key: 'status', header: 'Tila', value: (p) => t.enums.plantingStatus[p.status] },
		{ key: 'trees', header: 'Yksilöitä', value: (p) => p.trees?.length ?? 0 },
		{ key: 'lat', header: 'Lat', value: (p) => p.lat },
		{ key: 'lon', header: 'Lon', value: (p) => p.lon },
		{ key: 'published', header: 'Julkaistu', value: (p) => (p.published ? 'kyllä' : 'ei') },
		{ key: 'notes', header: 'Muistiinpanot', value: (p) => p.notes }
	];

	const TAXON_COLUMNS: Column<Taxon>[] = [
		{ key: 'sci', header: 'Tieteellinen nimi', value: (x) => scientificName(x) },
		{ key: 'genus', header: 'Suku', value: (x) => x.genus },
		{ key: 'species', header: 'Laji', value: (x) => x.species },
		{ key: 'rank', header: 'Alataso', value: (x) => x.infraspecific_rank },
		{ key: 'epithet', header: 'Alatason nimi', value: (x) => x.infraspecific_epithet },
		{ key: 'cultivar', header: 'Lajike', value: (x) => x.cultivar },
		{ key: 'fi', header: 'Suomenkielinen nimi', value: (x) => x.name_fi },
		{ key: 'mustila', header: 'Mustila', value: (x) => x.mustila_url },
		{ key: 'notes', header: 'Muistiinpanot', value: (x) => x.notes }
	];

	const OBSERVATION_COLUMNS: Column<Observation>[] = [
		{ key: 'at', header: 'Havaintoaika', value: (o) => formatDateTime(o.observed_at) },
		{ key: 'accession', header: 'Tunnus', value: (o) => o.plantings?.accession_code },
		{ key: 'sci', header: 'Tieteellinen nimi', value: (o) => scientificName(o.plantings?.taxa) },
		{ key: 'tree', header: 'Yksilö', value: (o) => o.trees?.label },
		{ key: 'kind', header: 'Laji', value: (o) => t.enums.kind[o.kind] },
		{ key: 'height', header: 'Korkeus (cm)', value: (o) => o.height_cm },
		{ key: 'diameter', header: 'Läpimitta (mm)', value: (o) => o.diameter_mm },
		{
			key: 'tags',
			header: 'Tunnisteet',
			value: (o) =>
				(o.observation_tags ?? [])
					.map((link) => link.tags?.name)
					.filter(Boolean)
					.join(', ')
		},
		{ key: 'body', header: 'Havainto', value: (o) => o.body }
	];

	interface TreeRow {
		accession: string | null;
		sci: string;
		label: string | null;
		status: string;
		lat: number | null;
		lon: number | null;
		accuracy: number | null;
		source: string;
	}

	const TREE_COLUMNS: Column<TreeRow>[] = [
		{ key: 'accession', header: 'Tunnus', value: (r) => r.accession },
		{ key: 'sci', header: 'Tieteellinen nimi', value: (r) => r.sci },
		{ key: 'label', header: 'Yksilö', value: (r) => r.label },
		{ key: 'status', header: 'Tila', value: (r) => r.status },
		{ key: 'lat', header: 'Lat', value: (r) => r.lat },
		{ key: 'lon', header: 'Lon', value: (r) => r.lon },
		{ key: 'accuracy', header: 'Tarkkuus (m)', value: (r) => r.accuracy },
		{ key: 'source', header: 'Sijainnin lähde', value: (r) => r.source }
	];

	async function runExport(format: 'csv' | 'xlsx') {
		exporting = true;
		try {
			if (exportWhat === 'plantings') {
				const data = await fetchPlantings();
				await emit(data, PLANTING_COLUMNS, 'istutukset', format);
			} else if (exportWhat === 'taxa') {
				const data = await fetchTaxa();
				await emit(data, TAXON_COLUMNS, 'taksonit', format);
			} else if (exportWhat === 'observations') {
				const data = await fetchObservations({});
				await emit(data, OBSERVATION_COLUMNS, 'havainnot', format);
			} else {
				const plantings = await fetchPlantings();
				const data: TreeRow[] = plantings.flatMap((p) =>
					(p.trees ?? []).map((tree) => ({
						accession: p.accession_code,
						sci: scientificName(p.taxa),
						label: tree.label,
						status: t.enums.treeStatus[tree.status],
						lat: tree.lat,
						lon: tree.lon,
						accuracy: tree.position_accuracy_m,
						source: tree.position_source ? t.enums.positionSource[tree.position_source] : ''
					}))
				);
				await emit(data, TREE_COLUMNS, 'yksilot', format);
			}
		} finally {
			exporting = false;
		}
	}

	async function emit<T>(data: T[], columns: Column<T>[], base: string, format: 'csv' | 'xlsx') {
		if (format === 'csv') downloadCsv(data, columns, stamped(base, 'csv'));
		else await downloadXlsx(data, columns, stamped(base, 'xlsx'), base);
	}

	const EXAMPLE = `aika;suku;laji;suomenkielinen nimi;kpl;koko;alkuperä
2017_05;Larix;sibirica;siperianlehtikuusi;12;40 cm;Punkaharju
2019_09;Betula;pendula var. carelica;visakoivu;8;50 cm;oma kanta`;

	function downloadExample() {
		const blob = new Blob(['﻿' + EXAMPLE], { type: 'text/csv;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'esimerkki-istutukset.csv';
		a.click();
	}
</script>

<svelte:head><title>{t.registry.importExport} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow"><a href="/rekisteri">{t.registry.title}</a></p>
	<h1>{t.registry.importExport}</h1>

	<section class="card block">
		<h2>{t.exporter.title}</h2>
		<p class="muted small">{t.exporter.help}</p>
		<div class="row wrap">
			<select bind:value={exportWhat} aria-label={t.exporter.what}>
				<option value="plantings">{t.planting.many}</option>
				<option value="trees">{t.tree.many}</option>
				<option value="taxa">{t.taxon.many}</option>
				<option value="observations">{t.observation.many}</option>
			</select>
			<button class="btn" type="button" onclick={() => runExport('csv')} disabled={exporting}>
				{t.exporter.csv}
			</button>
			<button class="btn" type="button" onclick={() => runExport('xlsx')} disabled={exporting}>
				{t.exporter.xlsx}
			</button>
		</div>
	</section>

	<section class="card block">
		<h2>{t.importer.title}</h2>
		<p class="muted small">{t.importer.help}</p>

		<div class="row wrap">
			<input type="file" accept=".csv,text/csv" onchange={onFile} aria-label={t.importer.pickFile} />
			<button class="btn btn-sm" type="button" onclick={downloadExample}>
				{t.importer.exampleHeader}
			</button>
		</div>

		{#if importDone}<p class="notice notice-ok">{importDone}</p>{/if}

		{#if rows.length}
			<p class="data muted count">{t.importer.rowsFound(rows.length)}</p>

			<h3>{t.importer.mapping}</h3>
			<div class="mapping">
				{#each FIELDS as field (field.key)}
					<div class="field">
						<label for="map-{field.key}">{field.label}</label>
						<select id="map-{field.key}" bind:value={mapping[field.key]}>
							<option value="">—</option>
							{#each headers as header (header)}
								<option value={header}>{header}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>

			<h3>{t.importer.preview}</h3>
			<div class="table-scroll">
				<table>
					<thead>
						<tr>
							{#each FIELDS as field (field.key)}
								<th>{field.label}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each preview as row, i (i)}
							<tr>
								{#each FIELDS as field (field.key)}
									<td>{cell(row, field.key) || '—'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<button
				class="btn btn-primary run"
				type="button"
				onclick={runImport}
				disabled={importing || !mapping.genus}
			>
				{importing ? t.importer.running : t.importer.run}
			</button>
			{#if !mapping.genus}
				<p class="muted small">Valitse vähintään suku-sarake.</p>
			{/if}
		{/if}

		{#if importErrors.length}
			<h3>{t.importer.errors}</h3>
			<ul class="errors">
				{#each importErrors as err, i (i)}
					<li>{err}</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.block {
		margin-bottom: 1.25rem;
	}

	.block h2 {
		margin-bottom: 0.3rem;
	}

	.block h3 {
		margin: 1.25rem 0 0.5rem;
	}

	.small {
		font-size: 0.8125rem;
	}

	.wrap {
		flex-wrap: wrap;
		margin-top: 0.75rem;
	}

	.row select {
		width: auto;
		min-width: 11rem;
	}

	.count {
		margin: 0.85rem 0 0;
	}

	.mapping {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0 0.75rem;
	}

	.run {
		margin-top: 0.9rem;
	}

	.errors {
		margin: 0;
		padding-left: 1.2rem;
		font-size: 0.8125rem;
		color: var(--rowan);
	}
</style>
