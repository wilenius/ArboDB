<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Plate from '$lib/components/Plate.svelte';
	import ObservationCard from '$lib/components/ObservationCard.svelte';
	import GrowthChart from '$lib/components/GrowthChart.svelte';
	import PlacementHistory from '$lib/components/PlacementHistory.svelte';
	import { fetchObservations, fetchTree } from '$lib/data';
	import { supabase, session } from '$lib/supabase';
	import { formatCoord, formatDate } from '$lib/format';
	import { geo } from '$lib/geolocation.svelte';
	import { t } from '$lib/i18n';
	import type { Observation, Target, Tree, TreeStatus } from '$lib/types';

	const id = $derived(page.params.id!);

	let tree = $state<Tree | null>(null);
	let observations = $state<Observation[]>([]);
	let error = $state('');
	let capturing = $state(false);
	let saving = $state(false);
	let editLabel = $state(false);
	let labelDraft = $state('');
	let notesDraft = $state('');

	$effect(() => {
		if ($session && id) load(id);
	});

	async function load(treeId: string) {
		try {
			tree = await fetchTree(treeId);
			labelDraft = tree.label ?? '';
			notesDraft = tree.notes ?? '';
			observations = await fetchObservations({ treeId });
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	async function patch(values: Partial<Tree>) {
		saving = true;
		try {
			const { error: err } = await supabase.from('trees').update(values).eq('id', id);
			if (err) throw err;
			await load(id);
		} catch {
			error = t.errors.save;
		} finally {
			saving = false;
		}
	}

	/** Re-stamp from GPS: overwrites a manual correction, so it records why. */
	async function capturePosition() {
		capturing = true;
		try {
			const fix = await geo.once();
			await patch({
				lat: fix.lat,
				lon: fix.lon,
				position_accuracy_m: fix.accuracy,
				position_source: 'gps'
			});
		} catch {
			error = t.nearby.locationDenied;
		} finally {
			capturing = false;
		}
	}

	async function removeTree() {
		if (!confirm(t.common.confirmDelete)) return;
		const plantingId = tree?.plantings?.id;
		await supabase.from('trees').delete().eq('id', id);
		goto(plantingId ? `/istutus/${plantingId}` : '/rekisteri');
	}

	const target = $derived<Target | null>(
		tree && tree.plantings
			? {
					kind: 'tree',
					tree,
					planting: tree.plantings,
					lat: tree.lat,
					lon: tree.lon,
					distance_m: null
				}
			: null
	);

	const hasMeasurements = $derived(
		observations.some((o) => o.height_cm != null || o.diameter_mm != null)
	);
</script>

<svelte:head><title>{tree?.label ?? t.tree.one} — {t.app.name}</title></svelte:head>

<div class="section narrow">
	{#if tree?.plantings}
		<p class="eyebrow">
			<a href="/rekisteri">{t.planting.many}</a> /
			<a href="/istutus/{tree.plantings.id}">{tree.plantings.accession_code}</a>
		</p>
	{/if}

	{#if error}<p class="notice notice-error">{error}</p>{/if}

	{#if !tree}
		<p class="muted">{t.common.loading}</p>
	{:else}
		<Plate target={target!} showDistance={false} />

		<div class="actions no-print">
			<a class="btn btn-primary" href="/havainto/uusi?tree={tree.id}">{t.observation.new}</a>
			<button class="btn" type="button" onclick={capturePosition} disabled={capturing}>
				{capturing ? t.tree.capturing : t.tree.captureGps}
			</button>
			<a class="btn" href="/kartta">{t.map.title}</a>
		</div>

		<dl class="sheet">
			<div>
				<dt>{t.tree.label}</dt>
				<dd>
					{#if editLabel}
						<div class="inline-edit">
							<input bind:value={labelDraft} maxlength="12" />
							<button
								class="btn btn-sm btn-primary"
								type="button"
								disabled={saving}
								onclick={async () => {
									await patch({ label: labelDraft || null });
									editLabel = false;
								}}>{t.common.save}</button
							>
							<button class="btn btn-sm" type="button" onclick={() => (editLabel = false)}>
								{t.common.cancel}
							</button>
						</div>
					{:else}
						<span class="data">{tree.label ?? '—'}</span>
						<button class="link-btn no-print" type="button" onclick={() => (editLabel = true)}>
							{t.common.edit}
						</button>
					{/if}
				</dd>
			</div>

			<div>
				<dt>{t.tree.status}</dt>
				<dd>
					<select
						class="status-select no-print"
						value={tree.status}
						onchange={(e) => patch({ status: e.currentTarget.value as TreeStatus })}
					>
						<option value="alive">{t.enums.treeStatus.alive}</option>
						<option value="dead">{t.enums.treeStatus.dead}</option>
						<option value="removed">{t.enums.treeStatus.removed}</option>
					</select>
					{#if tree.status_changed_at}
						<span class="data muted since">{formatDate(tree.status_changed_at)}</span>
					{/if}
				</dd>
			</div>

			<div>
				<dt>{t.planting.position}</dt>
				<dd class="data">{formatCoord(tree.lat, tree.lon)}</dd>
			</div>
			<div>
				<dt>{t.tree.accuracy}</dt>
				<dd class="data">
					{tree.position_accuracy_m != null ? `±${Math.round(tree.position_accuracy_m)} m` : '—'}
				</dd>
			</div>
			<div>
				<dt>{t.tree.source}</dt>
				<dd>{tree.position_source ? t.enums.positionSource[tree.position_source] : '—'}</dd>
			</div>
		</dl>

		<div class="field notes-field no-print">
			<label for="tree-notes">{t.tree.notes}</label>
			<textarea id="tree-notes" bind:value={notesDraft}></textarea>
			<button
				class="btn btn-sm"
				type="button"
				disabled={saving || notesDraft === (tree.notes ?? '')}
				onclick={() => patch({ notes: notesDraft || null })}
			>
				{saving ? t.common.saving : t.common.save}
			</button>
		</div>

		<PlacementHistory
			plantingId={tree.planting_id}
			treeId={tree.id}
			gardenId={tree.plantings?.garden_id ?? null}
			onmoved={() => load(id)}
		/>

		{#if hasMeasurements}
			<GrowthChart {observations} title="Kasvu{tree.label ? ` — ${tree.label}` : ''}" />
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

		<button class="btn btn-danger btn-sm delete no-print" type="button" onclick={removeTree}>
			{t.common.delete}
		</button>
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
		border-top: 1px solid var(--hairline);
	}

	.sheet > div {
		display: grid;
		grid-template-columns: 10rem 1fr;
		gap: 0.75rem;
		padding: 0.45rem 0;
		border-bottom: 1px solid var(--hairline);
		align-items: center;
	}

	dt {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--bark);
	}

	dd {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
	}

	.inline-edit {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.inline-edit input {
		width: 6rem;
	}

	.link-btn {
		background: none;
		border: 0;
		color: var(--moss);
		font-size: 0.8125rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
		padding: 0.25rem;
	}

	.status-select {
		width: auto;
		min-width: 8rem;
		min-height: 2.25rem;
		font-size: 0.9375rem;
	}

	.since {
		font-size: 0.75rem;
	}

	.notes-field {
		margin-bottom: 1.5rem;
	}

	.notes-field .btn {
		margin-top: 0.4rem;
	}

	.section-head {
		margin: 1.75rem 0 0.6rem;
	}

	.delete {
		margin-top: 1.5rem;
	}

	@media (max-width: 32rem) {
		.sheet > div {
			grid-template-columns: 1fr;
			gap: 0.1rem;
			align-items: start;
		}
	}
</style>
