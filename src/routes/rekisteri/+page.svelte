<script lang="ts">
	import Plate from '$lib/components/Plate.svelte';
	import { fetchPlantings, fetchProvisionalPlantingIds } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { session } from '$lib/supabase';
	import { scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Planting, PlantingStatus, Target } from '$lib/types';

	let plantings = $state<Planting[]>([]);
	let loading = $state(true);
	let error = $state('');

	let query = $state('');
	let status = $state<PlantingStatus | 'all'>('all');
	let origin = $state<'all' | 'planted' | 'original'>('all');
	let awaitingOnly = $state(false);
	let provisional = $state(new Set<string>());

	$effect(() => {
		if (!$session || !gardens.loaded) return;
		void gardens.active?.id;
		load();
	});

	async function load() {
		loading = true;
		try {
			plantings = await fetchPlantings(gardens.active?.id);
			provisional = await fetchProvisionalPlantingIds(plantings.map((p) => p.id));
			error = '';
		} catch {
			error = t.errors.load;
		} finally {
			loading = false;
		}
	}

	/** Still in a pot or a holding row, and still alive to be planted out. */
	const awaiting = $derived(
		plantings.filter((p) => p.status === 'active' && provisional.has(p.id))
	);

	const filtered = $derived(
		plantings.filter((p) => {
			if (awaitingOnly && !(p.status === 'active' && provisional.has(p.id))) return false;
			if (status !== 'all' && p.status !== status) return false;
			if (origin !== 'all' && p.origin_type !== origin) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				scientificName(p.taxa).toLowerCase().includes(q) ||
				(p.taxa?.name_fi ?? '').toLowerCase().includes(q) ||
				(p.accession_code ?? '').toLowerCase().includes(q) ||
				(p.provenance ?? '').toLowerCase().includes(q)
			);
		})
	);

	function asTarget(p: Planting): Target {
		return { kind: 'planting', tree: null, planting: p, lat: p.lat, lon: p.lon, distance_m: null };
	}

	const totals = $derived({
		plantings: filtered.length,
		specimens: filtered.reduce((n, p) => n + (p.count_planted ?? 0), 0),
		trees: filtered.reduce((n, p) => n + (p.trees?.length ?? 0), 0)
	});
</script>

<svelte:head><title>{t.registry.title} — {t.app.name}</title></svelte:head>

<div class="section">
	<div class="head">
		<div>
			<p class="eyebrow">{t.registry.title}</p>
			<h1>{t.planting.many}</h1>
		</div>
		<a class="btn btn-primary" href="/istutus/uusi">{t.planting.new}</a>
	</div>

	<nav class="subnav no-print">
		<a href="/rekisteri" aria-current="page">{t.planting.many}</a>
		<a href="/rekisteri/taksonit">{t.taxon.many}</a>
		<a href="/rekisteri/tunnisteet">{t.tag.many}</a>
		<a href="/puutarhat">{t.garden.many}</a>
		<a href="/rekisteri/tuonti">{t.registry.importExport}</a>
	</nav>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	<!-- Each control is labelled with what it narrows, and its neutral option
	     says so too: "Tila: Kaikki" read as a status a planting could be in
	     rather than as the absence of a filter. -->
	<div class="filters no-print">
		<div class="filter">
			<label class="filter-label" for="registry-search">{t.common.search}</label>
			<input
				id="registry-search"
				type="search"
				bind:value={query}
				placeholder="laji, tunnus, alkuperä"
			/>
		</div>
		<div class="filter">
			<label class="filter-label" for="registry-status">{t.planting.status}</label>
			<select id="registry-status" bind:value={status}>
				<option value="all">{t.planting.allStatuses}</option>
				<option value="active">{t.enums.plantingStatus.active}</option>
				<option value="dead">{t.enums.plantingStatus.dead}</option>
				<option value="removed">{t.enums.plantingStatus.removed}</option>
			</select>
		</div>
		<div class="filter">
			<label class="filter-label" for="registry-origin">{t.planting.originType}</label>
			<select id="registry-origin" bind:value={origin}>
				<option value="all">{t.planting.allOrigins}</option>
				<option value="planted">{t.enums.originType.planted}</option>
				<option value="original">{t.enums.originType.original}</option>
			</select>
		</div>
	</div>

	<!-- Surfaced only when there is something waiting: a chip that is always
	     there and always says nought is furniture, not a worklist. -->
	{#if awaiting.length}
		<button
			class="awaiting no-print"
			type="button"
			aria-pressed={awaitingOnly}
			onclick={() => (awaitingOnly = !awaitingOnly)}
		>
			<span>{t.placement.awaiting}</span>
			<span class="data count">{awaiting.length}</span>
		</button>
	{/if}

	<p class="tally data muted">
		{totals.plantings} istutusta · {totals.specimens} tainta · {totals.trees} yksilöä
	</p>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !filtered.length}
		<p class="empty">{t.common.empty}</p>
	{:else}
		<ul class="grid">
			{#each filtered as planting (planting.id)}
				<li>
					<Plate target={asTarget(planting)} showDistance={false} />
					{#if planting.trees?.length}
						<div class="tree-row">
							{#each planting.trees as tree (tree.id)}
								<a class="tree-chip" data-status={tree.status} href="/puu/{tree.id}">
									{tree.label ?? '·'}
								</a>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.subnav {
		display: flex;
		gap: 0.15rem;
		flex-wrap: wrap;
		margin: 0.9rem 0 1rem;
		border-bottom: 1px solid var(--hairline);
	}

	.subnav a {
		padding: 0.5rem 0.75rem;
		text-decoration: none;
		color: var(--bark);
		font-size: 0.875rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.subnav a[aria-current='page'] {
		color: var(--ink);
		border-bottom-color: var(--moss);
	}

	.filters {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: 1fr;
		margin-bottom: 0.75rem;
		align-items: end;
	}

	.filter-label {
		display: block;
		font-family: var(--font-data);
		font-size: 0.625rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bark);
		margin-bottom: 0.2rem;
	}

	.awaiting {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.6rem;
		padding: 0.35rem 0.7rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		background: none;
		color: var(--ink-soft);
		font-family: var(--font-ui);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.awaiting[aria-pressed='true'] {
		border-color: var(--moss);
		background: var(--moss-pale);
		color: var(--ink);
	}

	.awaiting .count {
		font-size: 0.75rem;
		color: var(--bark);
	}

	.tally {
		margin: 0 0 0.85rem;
	}

	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
	}

	/* Individually tracked specimens hang off the plate like field tags. */
	.tree-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0.35rem 0 0 0.5rem;
	}

	.tree-chip {
		min-width: 1.7rem;
		text-align: center;
		font-family: var(--font-data);
		font-size: 0.75rem;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--hairline-strong);
		border-radius: 2px;
		text-decoration: none;
		color: var(--ink-soft);
		background: var(--paper-raised);
	}

	.tree-chip[data-status='dead'] {
		color: var(--rowan);
		border-color: color-mix(in oklab, var(--rowan) 45%, transparent);
	}

	.tree-chip[data-status='removed'] {
		text-decoration: line-through;
		color: var(--bark);
	}

	@media (min-width: 42rem) {
		.filters {
			grid-template-columns: 2fr 1fr 1fr;
		}
	}
</style>
