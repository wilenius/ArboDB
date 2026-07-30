<script lang="ts">
	/**
	 * Where a tree, or a whole batch, has stood — and the form for saying it has
	 * moved.
	 *
	 * The distinction the panel is built around: recording a transplant is not
	 * the same act as fixing a bad coordinate. A move gets its own date and its
	 * own row on the timeline; a correction happens through the GPS button or by
	 * dragging the marker on the map, and shows up here only as a muted line so
	 * it can be audited without cluttering the story of where the tree has been.
	 */
	import { fetchPlacements, recordPlacement } from '$lib/data';
	import { distanceMeters } from '$lib/geo';
	import { formatCoord, formatDate } from '$lib/format';
	import { gardens } from '$lib/gardens.svelte';
	import { geo } from '$lib/geolocation.svelte';
	import { t } from '$lib/i18n';
	import { MOVEMENT_REASONS, type Placement } from '$lib/types';

	let {
		plantingId,
		treeId = null,
		gardenId = null,
		onmoved
	}: {
		plantingId: string;
		/** Null positions the batch by its own centroid instead. */
		treeId?: string | null;
		gardenId?: string | null;
		onmoved?: () => void;
	} = $props();

	let placements = $state<Placement[]>([]);
	let loading = $state(true);
	let error = $state('');
	let saved = $state('');

	let open = $state(false);
	let busy = $state(false);
	let locating = $state(false);

	let form = $state({
		occurred_on: new Date().toISOString().slice(0, 10),
		lat: '',
		lon: '',
		accuracy_m: null as number | null,
		source: 'manual' as 'gps' | 'manual',
		garden_id: '',
		provisional: false,
		note: ''
	});

	$effect(() => {
		void plantingId;
		void treeId;
		load();
	});

	async function load() {
		loading = true;
		try {
			placements = await fetchPlacements({ plantingId, treeId });
			error = '';
		} catch {
			error = t.errors.load;
		} finally {
			loading = false;
		}
	}

	function startMove() {
		form = {
			occurred_on: new Date().toISOString().slice(0, 10),
			lat: '',
			lon: '',
			accuracy_m: null,
			source: 'manual',
			garden_id: gardenId ?? gardens.active?.id ?? '',
			provisional: false,
			note: ''
		};
		saved = '';
		open = true;
	}

	async function useMyPosition() {
		locating = true;
		try {
			const fix = await geo.once();
			form.lat = fix.lat.toFixed(6);
			form.lon = fix.lon.toFixed(6);
			form.accuracy_m = fix.accuracy;
			form.source = 'gps';
		} catch {
			error = t.nearby.locationDenied;
		} finally {
			locating = false;
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const lat = Number(form.lat.replace(',', '.'));
		const lon = Number(form.lon.replace(',', '.'));
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

		busy = true;
		try {
			await recordPlacement({
				planting_id: plantingId,
				tree_id: treeId,
				garden_id: form.garden_id || null,
				lat,
				lon,
				// Typed-in coordinates are nobody's measurement, so the accuracy
				// only travels with a fix the phone actually took.
				accuracy_m: form.source === 'gps' ? form.accuracy_m : null,
				source: form.source,
				reason: 'moved',
				provisional: form.provisional,
				occurred_on: form.occurred_on,
				note: form.note.trim() || null
			});
			open = false;
			saved = t.placement.saved;
			await load();
			onmoved?.();
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	/** Movement only: how far the tree travelled since it last stood still. */
	const movements = $derived(placements.filter((p) => MOVEMENT_REASONS.includes(p.reason)));

	function stepDistance(placement: Placement): number | null {
		const i = movements.findIndex((m) => m.id === placement.id);
		if (i < 1) return null;
		const prev = movements[i - 1];
		if (prev.lat == null || prev.lon == null || placement.lat == null || placement.lon == null) {
			return null;
		}
		return distanceMeters(prev.lat, prev.lon, placement.lat, placement.lon);
	}
</script>

<section class="placements">
	<div class="spread section-head">
		<h2>{t.placement.history}</h2>
		{#if !open}
			<button class="btn btn-sm no-print" type="button" onclick={startMove}>
				{t.placement.move}
			</button>
		{/if}
	</div>

	{#if error}<p class="notice notice-error">{error}</p>{/if}
	{#if saved}<p class="notice notice-ok">{saved}</p>{/if}

	{#if open}
		<form class="move-form no-print" onsubmit={submit}>
			<p class="lead">{t.placement.moveHelp}</p>

			<div class="field-grid">
				<div class="field">
					<label for="move-date">{t.placement.when}</label>
					<input id="move-date" type="date" bind:value={form.occurred_on} required />
				</div>
				<div class="field">
					<label for="move-lat">Lat</label>
					<input id="move-lat" inputmode="decimal" bind:value={form.lat} required />
				</div>
				<div class="field">
					<label for="move-lon">Lon</label>
					<input id="move-lon" inputmode="decimal" bind:value={form.lon} required />
				</div>
			</div>

			<div class="gps">
				<button class="btn btn-sm" type="button" onclick={useMyPosition} disabled={locating}>
					{locating ? t.planting.capturing : t.placement.useMyPosition}
				</button>
				{#if form.source === 'gps' && form.accuracy_m != null}
					<span class="help data">{t.nearby.accuracy} ±{Math.round(form.accuracy_m)} m</span>
				{/if}
			</div>

			{#if gardens.multiple}
				<div class="field">
					<label for="move-garden">{t.placement.toGarden}</label>
					<select id="move-garden" bind:value={form.garden_id}>
						{#each gardens.all as garden (garden.id)}
							<option value={garden.id}>{garden.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<label class="check">
				<input type="checkbox" bind:checked={form.provisional} />
				<span>
					{t.placement.provisional}
					<em>{t.placement.provisionalHelp}</em>
				</span>
			</label>

			<div class="field">
				<label for="move-note">{t.placement.note}</label>
				<input id="move-note" bind:value={form.note} placeholder={t.placement.notePlaceholder} />
			</div>

			<p class="help">{t.placement.correctionHelp}</p>

			<div class="actions">
				<button class="btn btn-primary" type="submit" disabled={busy}>
					{busy ? t.common.saving : t.common.save}
				</button>
				<button class="btn" type="button" onclick={() => (open = false)}>{t.common.cancel}</button>
			</div>
		</form>
	{/if}

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !placements.length}
		<p class="empty">{t.placement.none}</p>
	{:else}
		<ol class="trail">
			{#each placements as placement (placement.id)}
				{@const step = stepDistance(placement)}
				<li class:correction={placement.reason === 'corrected'}>
					<span class="when data">{formatDate(placement.occurred_on)}</span>
					<span class="what">
						<span class="reason">
							{t.placement.reasons[placement.reason]}
							{#if placement.provisional}
								<span class="badge">{t.placement.provisional}</span>
							{/if}
						</span>
						<span class="where data">{formatCoord(placement.lat, placement.lon)}</span>
						{#if step != null && step >= 1}
							<span class="step data">{t.placement.movedBy(step)}</span>
						{/if}
						{#if placement.gardens?.name}
							<span class="garden">{placement.gardens.name}</span>
						{/if}
						{#if placement.note}<span class="note">{placement.note}</span>{/if}
					</span>
				</li>
			{/each}
		</ol>

		{#if movements.length < 2}
			<p class="muted small">{t.placement.onlyOne}</p>
		{/if}
	{/if}
</section>

<style>
	.placements {
		margin: 1.5rem 0;
	}

	.section-head {
		margin-bottom: 0.5rem;
	}

	.lead {
		margin: 0 0 0.85rem;
		font-size: 0.875rem;
		color: var(--ink-soft);
	}

	.move-form {
		border: 1px solid var(--hairline);
		border-left: 3px solid var(--moss);
		border-radius: var(--radius);
		padding: 0.9rem 1rem 0.1rem;
		margin-bottom: 1rem;
		background: var(--paper-raised);
	}

	.gps {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		margin: 0 0 0.85rem;
	}

	.help {
		font-size: 0.75rem;
		color: var(--bark);
		margin: 0 0 0.85rem;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		margin: 0 0 0.9rem;
	}

	/* A stake line down the left with a marker per stop: the same visual idea
	   as the accession plate, read top to bottom in chronological order. */
	.trail {
		list-style: none;
		margin: 0;
		padding: 0 0 0 1rem;
		border-left: 1px solid var(--hairline);
		display: grid;
		gap: 0.75rem;
	}

	.trail li {
		position: relative;
		display: grid;
		grid-template-columns: 6.5rem 1fr;
		gap: 0.6rem;
		align-items: baseline;
	}

	.trail li::before {
		content: '';
		position: absolute;
		left: -1.3rem;
		top: 0.45rem;
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: var(--moss);
	}

	/* Corrections stay legible but recede: they are not part of the journey. */
	.correction {
		opacity: 0.55;
	}

	.correction::before {
		background: var(--bark);
	}

	.when {
		font-size: 0.75rem;
		color: var(--bark);
	}

	.what {
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.reason {
		font-size: 0.9375rem;
	}

	.badge {
		font-family: var(--font-data);
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--bark);
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		padding: 0.05rem 0.3rem;
		margin-left: 0.35rem;
	}

	.where,
	.step {
		font-size: 0.75rem;
		color: var(--bark);
	}

	.garden,
	.note {
		font-size: 0.8125rem;
		color: var(--ink-soft);
	}

	.small {
		font-size: 0.8125rem;
		margin-top: 0.75rem;
	}
</style>
