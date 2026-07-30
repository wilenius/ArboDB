<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Plate from '$lib/components/Plate.svelte';
	import PlantingForm from '$lib/components/PlantingForm.svelte';
	import ObservationCard from '$lib/components/ObservationCard.svelte';
	import PlacementHistory from '$lib/components/PlacementHistory.svelte';
	import { fetchObservations, fetchPlanting, fetchTaxa } from '$lib/data';
	import { supabase, session } from '$lib/supabase';
	import { formatCoord, formatPlantedDate } from '$lib/format';
	import { geo } from '$lib/geolocation.svelte';
	import { t } from '$lib/i18n';
	import type { Observation, Planting, Target, Taxon } from '$lib/types';

	const id = $derived(page.params.id!);

	let planting = $state<Planting | null>(null);
	let observations = $state<Observation[]>([]);
	let taxa = $state<Taxon[]>([]);
	let editing = $state(false);
	let busy = $state(false);
	let error = $state('');
	let capturing = $state(false);

	$effect(() => {
		if ($session && id) load(id);
	});

	async function load(plantingId: string) {
		try {
			planting = await fetchPlanting(plantingId);
			observations = await fetchObservations({ plantingId });
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	async function startEdit() {
		if (!taxa.length) taxa = await fetchTaxa();
		editing = true;
	}

	async function save(values: Partial<Planting>) {
		busy = true;
		try {
			const { error: err } = await supabase.from('plantings').update(values).eq('id', id);
			if (err) throw err;
			editing = false;
			await load(id);
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	async function removePlanting() {
		if (!confirm(t.common.confirmDelete)) return;
		await supabase.from('plantings').delete().eq('id', id);
		goto('/rekisteri');
	}

	/** A new specimen is stamped where the owner is standing, with its accuracy. */
	async function addTree() {
		capturing = true;
		let position: { lat: number | null; lon: number | null; acc: number | null } = {
			lat: null,
			lon: null,
			acc: null
		};
		try {
			const fix = await geo.once();
			position = { lat: fix.lat, lon: fix.lon, acc: fix.accuracy };
		} catch {
			// No fix available — create the specimen anyway and position it on the
			// map later. Better an unpositioned record than a lost observation.
		}
		const used = new Set((planting?.trees ?? []).map((x) => x.label));
		const nextLabel = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((c) => !used.has(c)) ?? null;

		const { data, error: err } = await supabase
			.from('trees')
			.insert({
				planting_id: id,
				label: nextLabel,
				lat: position.lat,
				lon: position.lon,
				position_accuracy_m: position.acc,
				position_source: position.lat ? 'gps' : null
			})
			.select('id')
			.single();
		capturing = false;
		if (err) {
			error = t.errors.save;
			return;
		}
		goto(`/puu/${data.id}`);
	}

	const target = $derived<Target | null>(
		planting
			? {
					kind: 'planting',
					tree: null,
					planting,
					lat: planting.lat,
					lon: planting.lon,
					distance_m: null
				}
			: null
	);
</script>

<svelte:head>
	<title>{planting?.accession_code ?? t.planting.one} — {t.app.name}</title>
</svelte:head>

<div class="section narrow">
	<p class="eyebrow"><a href="/rekisteri">{t.planting.many}</a></p>

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	{#if !planting}
		<p class="muted">{t.common.loading}</p>
	{:else if editing}
		<h1>{t.common.edit}</h1>
		<PlantingForm {planting} {taxa} {busy} onsubmit={save} oncancel={() => (editing = false)} />
		<button class="btn btn-danger btn-sm delete" type="button" onclick={removePlanting}>
			{t.common.delete}
		</button>
	{:else}
		<Plate target={target!} showDistance={false} />

		<div class="actions no-print">
			<a class="btn btn-primary" href="/havainto/uusi?planting={planting.id}">
				{t.observation.new}
			</a>
			<button class="btn" type="button" onclick={startEdit}>{t.common.edit}</button>
			{#if planting.taxa?.mustila_url}
				<a class="btn" href={planting.taxa.mustila_url} target="_blank" rel="noopener">
					{t.taxon.openMustila} ↗
				</a>
			{/if}
		</div>

		<!-- The planting record itself, as a survey sheet: label, value, in mono. -->
		<dl class="sheet">
			<div><dt>{t.planting.accession}</dt><dd class="data">{planting.accession_code ?? '—'}</dd></div>
			<div>
				<dt>{t.planting.year}</dt>
				<dd class="data">{formatPlantedDate(planting.planted_year, planting.planted_month)}</dd>
			</div>
			<div><dt>{t.planting.count}</dt><dd class="data">{planting.count_planted}</dd></div>
			<div>
				<dt>{t.planting.size}</dt>
				<dd class="data">{planting.seedling_size_cm ? `${planting.seedling_size_cm} cm` : '—'}</dd>
			</div>
			<div><dt>{t.planting.propagation}</dt><dd>{planting.propagation ?? '—'}</dd></div>
			<div><dt>{t.planting.provenance}</dt><dd>{planting.provenance ?? '—'}</dd></div>
			<div><dt>{t.planting.originType}</dt><dd>{t.enums.originType[planting.origin_type]}</dd></div>
			<div><dt>{t.planting.status}</dt><dd>{t.enums.plantingStatus[planting.status]}</dd></div>
			<div>
				<dt>{t.planting.position}</dt>
				<dd class="data">
					{formatCoord(planting.lat, planting.lon)}{planting.radius_m ? ` · r ${planting.radius_m} m` : ''}
				</dd>
			</div>
			<div>
				<dt>{t.planting.published}</dt>
				<dd>{planting.published ? t.common.yes : t.common.no}</dd>
			</div>
		</dl>

		{#if planting.notes}
			<p class="notes">{planting.notes}</p>
		{/if}

		<section>
			<div class="spread section-head">
				<h2>{t.planting.trees}</h2>
				<button class="btn btn-sm" type="button" onclick={addTree} disabled={capturing}>
					{capturing ? t.tree.capturing : t.planting.addTree}
				</button>
			</div>

			{#if !planting.trees?.length}
				<p class="empty">{t.planting.noTrees}</p>
			{:else}
				<ul class="trees">
					{#each planting.trees as tree (tree.id)}
						<li>
							<a class="tree-row" href="/puu/{tree.id}" data-status={tree.status}>
								<span class="tree-label data">{tree.label ?? '—'}</span>
								<span class="tree-status">{t.enums.treeStatus[tree.status]}</span>
								<span class="data muted tree-coord">{formatCoord(tree.lat, tree.lon)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- A batch is positioned by its own centroid only while it has no
		     individually tracked specimens. Once it does, each of them carries
		     its own history and a centroid track would be a second, quietly
		     disagreeing answer to the same question. -->
		{#if !planting.trees?.length}
			<PlacementHistory
				plantingId={planting.id}
				gardenId={planting.garden_id}
				onmoved={() => load(id)}
			/>
		{/if}

		<section>
			<div class="spread section-head">
				<h2>{t.observation.many}</h2>
				<span class="data muted">{t.observation.count(observations.length)}</span>
			</div>
			{#if !observations.length}
				<p class="empty">{t.observation.none}</p>
			{:else}
				<div class="stack">
					{#each observations as observation (observation.id)}
						<ObservationCard {observation} />
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.narrow {
		max-width: 44rem;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin: 0.85rem 0 1.25rem;
	}

	.sheet {
		margin: 0 0 1rem;
		display: grid;
		gap: 0;
		border-top: 1px solid var(--hairline);
	}

	.sheet > div {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--hairline);
	}

	dt {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--bark);
		padding-top: 0.1rem;
	}

	dd {
		margin: 0;
	}

	.notes {
		background: var(--paper-raised);
		border-left: 3px solid var(--moss-pale);
		padding: 0.65rem 0.8rem;
		border-radius: 0 var(--radius) var(--radius) 0;
		white-space: pre-wrap;
	}

	.section-head {
		margin: 1.75rem 0 0.6rem;
	}

	.trees {
		list-style: none;
		margin: 0;
		padding: 0;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--paper-raised);
	}

	.trees li + li .tree-row {
		border-top: 1px solid var(--hairline);
	}

	.tree-row {
		display: grid;
		grid-template-columns: 3rem 6rem 1fr;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.75rem;
		text-decoration: none;
		color: var(--ink);
		min-height: var(--tap);
	}

	.tree-row:hover {
		background: color-mix(in oklab, var(--moss) 7%, transparent);
	}

	.tree-label {
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.tree-status {
		font-size: 0.8125rem;
		color: var(--bark);
	}

	.tree-row[data-status='dead'] .tree-status {
		color: var(--rowan);
	}

	.tree-coord {
		text-align: right;
		font-size: 0.75rem;
	}

	.delete {
		margin-top: 1rem;
	}

	@media (max-width: 32rem) {
		.sheet > div {
			grid-template-columns: 1fr;
			gap: 0.1rem;
		}

		.tree-row {
			grid-template-columns: 2.5rem 1fr;
		}

		.tree-coord {
			grid-column: 1 / -1;
			text-align: left;
		}
	}
</style>
