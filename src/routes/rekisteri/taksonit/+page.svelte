<script lang="ts">
	import SciName from '$lib/components/SciName.svelte';
	import { fetchTaxa } from '$lib/data';
	import { supabase, session } from '$lib/supabase';
	import { scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import {
		lajiSearchEnabled,
		normalizeTaxonNames,
		searchLajiTaxa,
		taxonNamesFromSuggestion,
		type LajiTaxonSuggestion
	} from '$lib/taxa';
	import type { Taxon } from '$lib/types';

	let taxa = $state<Taxon[]>([]);
	let counts = $state<Record<string, { plantings: number; planted: number }>>({});
	let query = $state('');
	let editing = $state<Partial<Taxon> | null>(null);
	let busy = $state(false);
	let error = $state('');
	let lajiQuery = $state('');
	let lajiResults = $state<LajiTaxonSuggestion[]>([]);
	let lajiSearching = $state(false);
	let lajiComplete = $state(false);
	let lajiError = $state('');

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		try {
			taxa = await fetchTaxa();
			const { data, error: countError } = await supabase
				.from('plantings')
				.select('taxon_id, count_planted');
			if (countError) throw countError;
			const tally: Record<string, { plantings: number; planted: number }> = {};
			for (const row of data ?? []) {
				if (!row.taxon_id) continue;
				const count = tally[row.taxon_id] ?? { plantings: 0, planted: 0 };
				count.plantings += 1;
				count.planted += row.count_planted;
				tally[row.taxon_id] = count;
			}
			counts = tally;
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	const filtered = $derived(
		query.trim()
			? taxa.filter((x) => {
					const q = query.toLowerCase();
					return (
						scientificName(x).toLowerCase().includes(q) ||
						(x.name_fi ?? '').toLowerCase().includes(q)
					);
				})
			: taxa
	);

	$effect(() => {
		const text = lajiQuery.trim();
		if (!editing || !lajiSearchEnabled || text.length < 2) {
			lajiResults = [];
			lajiSearching = false;
			lajiComplete = false;
			lajiError = '';
			return;
		}

		const controller = new AbortController();
		const timer = window.setTimeout(async () => {
			lajiSearching = true;
			lajiComplete = false;
			lajiError = '';
			try {
				lajiResults = await searchLajiTaxa(text, controller.signal);
				lajiComplete = true;
			} catch (err) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				lajiError = t.errors.taxonSearch;
			} finally {
				if (!controller.signal.aborted) lajiSearching = false;
			}
		}, 300);

		return () => {
			window.clearTimeout(timer);
			controller.abort();
		};
	});

	function blank(): Partial<Taxon> {
		return {
			genus: '',
			species: '',
			infraspecific_rank: '',
			infraspecific_epithet: '',
			cultivar: '',
			name_fi: '',
			mustila_url: '',
			notes: ''
		};
	}

	function edit(taxon: Partial<Taxon>) {
		editing = taxon;
		lajiQuery = '';
		lajiResults = [];
		lajiError = '';
	}

	function suggestionTaxon(suggestion: LajiTaxonSuggestion): Taxon {
		return {
			id: suggestion.id,
			...taxonNamesFromSuggestion(suggestion),
			cultivar: null,
			mustila_url: null,
			notes: null
		};
	}

	function chooseSuggestion(suggestion: LajiTaxonSuggestion) {
		if (!editing) return;
		editing = { ...editing, ...taxonNamesFromSuggestion(suggestion) };
		lajiQuery = '';
		lajiResults = [];
	}

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (!editing) return;
		busy = true;
		const clean = (v: unknown) => (v === '' || v == null ? null : String(v).trim());
		const names = normalizeTaxonNames({
			genus: String(editing.genus ?? ''),
			species: clean(editing.species),
			infraspecific_rank: clean(editing.infraspecific_rank),
			infraspecific_epithet: clean(editing.infraspecific_epithet),
			name_fi: clean(editing.name_fi)
		});
		const values = {
			...names,
			cultivar: clean(editing.cultivar),
			mustila_url: clean(editing.mustila_url),
			notes: clean(editing.notes)
		};
		try {
			const { error: err } = editing.id
				? await supabase.from('taxa').update(values).eq('id', editing.id)
				: await supabase.from('taxa').insert(values);
			if (err) throw err;
			editing = null;
			await load();
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	async function remove(taxon: Taxon) {
		if (counts[taxon.id]?.plantings) {
			error = 'Taksonilla on istutuksia, joten sitä ei voi poistaa.';
			return;
		}
		if (!confirm(t.common.confirmDelete)) return;
		await supabase.from('taxa').delete().eq('id', taxon.id);
		await load();
	}
</script>

<svelte:head><title>{t.taxon.many} — {t.app.name}</title></svelte:head>

<div class="section">
	<div class="head">
		<div>
			<p class="eyebrow"><a href="/rekisteri">{t.registry.title}</a></p>
			<h1>{t.taxon.many}</h1>
		</div>
		<button class="btn btn-primary" type="button" onclick={() => edit(blank())}>
			{t.taxon.new}
		</button>
	</div>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	{#if editing}
		<form class="card editor" onsubmit={save}>
			<h2>{editing.id ? t.common.edit : t.taxon.new}</h2>
			{#if lajiSearchEnabled}
				<div class="laji-search">
					<div class="field">
						<label for="laji-query">{t.taxon.lajiSearch}</label>
						<input id="laji-query" type="search" bind:value={lajiQuery} autocomplete="off" />
						<p class="hint">{t.taxon.lajiSearchHelp}</p>
					</div>
					{#if lajiSearching}<p class="muted small">{t.common.loading}</p>{/if}
					{#if lajiError}<p class="notice notice-error">{lajiError}</p>{/if}
					{#if lajiResults.length}
						<ul class="laji-results">
							{#each lajiResults as result (result.id)}
								<li>
									<button type="button" onclick={() => chooseSuggestion(result)}>
										<SciName taxon={suggestionTaxon(result)} />
										{#if result.vernacularName}
											<span>{result.vernacularName}</span>
										{/if}
									</button>
								</li>
							{/each}
						</ul>
					{:else if lajiComplete}
						<p class="muted small">{t.taxon.lajiNoResults}</p>
					{/if}
				</div>
			{/if}
			<div class="field-grid">
				<div class="field">
					<label for="genus">{t.taxon.genus}</label>
					<input id="genus" bind:value={editing.genus} required placeholder="Larix" />
				</div>
				<div class="field">
					<label for="species">{t.taxon.species}</label>
					<input id="species" bind:value={editing.species} placeholder="sibirica" />
				</div>
				<div class="field">
					<label for="rank">{t.taxon.rank}</label>
					<input id="rank" bind:value={editing.infraspecific_rank} placeholder="var. / subsp. / f." />
				</div>
				<div class="field">
					<label for="epithet">{t.taxon.epithet}</label>
					<input id="epithet" bind:value={editing.infraspecific_epithet} placeholder="carelica" />
				</div>
			</div>
			<div class="field-grid">
				<div class="field">
					<label for="cultivar">{t.taxon.cultivar}</label>
					<input id="cultivar" bind:value={editing.cultivar} placeholder="Royal Red" />
				</div>
				<div class="field">
					<label for="name-fi">{t.taxon.nameFi}</label>
					<input id="name-fi" bind:value={editing.name_fi} placeholder="siperianlehtikuusi" />
				</div>
			</div>
			<div class="field">
				<label for="mustila">{t.taxon.mustilaUrl}</label>
				<input id="mustila" type="url" bind:value={editing.mustila_url} placeholder="https://www.mustila.fi/…" />
			</div>
			<div class="field">
				<label for="taxon-notes">{t.taxon.notes}</label>
				<textarea id="taxon-notes" bind:value={editing.notes}></textarea>
			</div>
			<div class="row">
				<button class="btn btn-primary" type="submit" disabled={busy}>
					{busy ? t.common.saving : t.common.save}
				</button>
				<button class="btn" type="button" onclick={() => (editing = null)}>{t.common.cancel}</button>
			</div>
		</form>
	{/if}

	<input
		class="search"
		type="search"
		bind:value={query}
		placeholder={t.common.search}
		aria-label={t.common.search}
	/>

	<div class="table-scroll">
		<table>
			<thead>
				<tr>
					<th>Tieteellinen nimi</th>
					<th>{t.taxon.nameFi}</th>
					<th>{t.taxon.plantingCount}</th>
					<th>{t.taxon.plantedCount}</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as taxon (taxon.id)}
					<tr>
						<td>
							<SciName {taxon} />
							{#if taxon.mustila_url}
								<a class="ext" href={taxon.mustila_url} target="_blank" rel="noopener">↗</a>
							{/if}
						</td>
						<td>{taxon.name_fi ?? '—'}</td>
						<td class="num">{counts[taxon.id]?.plantings ?? 0}</td>
						<td class="num">{counts[taxon.id]?.planted ?? 0}</td>
						<td class="num actions-cell">
							<button class="link-btn" type="button" onclick={() => edit({ ...taxon })}>
								{t.common.edit}
							</button>
							<button class="link-btn danger" type="button" onclick={() => remove(taxon)}>
								{t.common.delete}
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.editor {
		margin-bottom: 1.25rem;
	}

	.editor h2 {
		margin-bottom: 0.7rem;
	}

	.laji-search {
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--hairline);
	}

	.laji-search .hint,
	.laji-search .small {
		font-size: 0.8125rem;
		margin: 0.3rem 0 0;
	}

	.laji-results {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		border: 1px solid var(--hairline);
		background: var(--paper-raised);
	}

	.laji-results li + li {
		border-top: 1px solid var(--hairline);
	}

	.laji-results button {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		width: 100%;
		min-height: var(--tap);
		padding: 0.55rem 0.7rem;
		border: 0;
		background: transparent;
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}

	.laji-results button:hover {
		background: var(--moss-pale);
	}

	.laji-results button > span:last-child:not(.sci) {
		font-size: 0.8125rem;
		color: var(--bark);
	}

	.search {
		margin-bottom: 0.85rem;
	}

	.ext {
		text-decoration: none;
		margin-left: 0.3rem;
		color: var(--lichen);
	}

	.actions-cell {
		white-space: nowrap;
	}

	.link-btn {
		background: none;
		border: 0;
		color: var(--moss);
		font-size: 0.8125rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
		padding: 0.2rem 0.3rem;
	}

	.danger {
		color: var(--rowan);
	}
</style>
