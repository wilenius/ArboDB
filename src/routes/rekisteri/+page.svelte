<script lang="ts">
	import Plate from '$lib/components/Plate.svelte';
	import { fetchPlantings } from '$lib/data';
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

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		loading = true;
		try {
			plantings = await fetchPlantings();
			error = '';
		} catch {
			error = t.errors.load;
		} finally {
			loading = false;
		}
	}

	const filtered = $derived(
		plantings.filter((p) => {
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
		<a href="/rekisteri/tuonti">{t.registry.importExport}</a>
	</nav>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	<div class="filters no-print">
		<input
			type="search"
			bind:value={query}
			placeholder="{t.common.search}: laji, tunnus, alkuperä"
			aria-label={t.common.search}
		/>
		<select bind:value={status} aria-label={t.planting.status}>
			<option value="all">{t.planting.status}: {t.common.all}</option>
			<option value="active">{t.enums.plantingStatus.active}</option>
			<option value="dead">{t.enums.plantingStatus.dead}</option>
			<option value="removed">{t.enums.plantingStatus.removed}</option>
		</select>
		<select bind:value={origin} aria-label={t.planting.originType}>
			<option value="all">{t.planting.originType}: {t.common.all}</option>
			<option value="planted">{t.enums.originType.planted}</option>
			<option value="original">{t.enums.originType.original}</option>
		</select>
	</div>

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
