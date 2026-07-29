<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { gardens } from '$lib/gardens.svelte';
	import { geo } from '$lib/geolocation.svelte';
	import { supabase, session } from '$lib/supabase';
	import {
		polygonToRing,
		ringAreaHectares,
		ringCentroid,
		ringPerimeterMeters,
		ringToPolygon,
		type Ring
	} from '$lib/geo';
	import { t } from '$lib/i18n';
	import PropertyLookup from '$lib/components/PropertyLookup.svelte';
	import type { ParcelResult } from '$lib/mml';
	import type { BoundarySource, Garden } from '$lib/types';

	/**
	 * Gardens: the plot a planting stands in.
	 *
	 * The boundary comes from one of two places. Type a property identifier and
	 * Maanmittauslaitos' register hands over the registered outline; failing
	 * that, tap corners on the aerial photo, because a rough outline that exists
	 * today beats surveyed data that arrives some time next year. Either way the
	 * source is stored alongside it, so a hand-drawn sketch is never mistaken
	 * for the register's own geometry.
	 */

	let counts = $state<Record<string, number>>({});
	let editing = $state<Garden | null>(null);
	let creating = $state(false);
	let draftName = $state('');
	let draftNotes = $state('');
	let drawing = $state(false);
	let ring = $state<Ring>([]);
	/** Where the ring in the editor came from, tracked so saving records it. */
	let draftSource = $state<BoundarySource>('drawn');
	let parcelNote = $state('');
	let busy = $state(false);
	let error = $state('');
	let message = $state('');
	let mapView = $state<MapView | undefined>();

	onMount(() => geo.start());
	onDestroy(() => geo.stop());

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		try {
			await gardens.load();
			const { data } = await supabase.from('plantings').select('garden_id');
			const tally: Record<string, number> = {};
			for (const row of data ?? []) {
				if (row.garden_id) tally[row.garden_id] = (tally[row.garden_id] ?? 0) + 1;
			}
			counts = tally;
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	function flash(text: string) {
		message = text;
		setTimeout(() => (message = ''), 2500);
	}

	function startEdit(garden: Garden) {
		editing = garden;
		creating = false;
		draftName = garden.name;
		draftNotes = garden.notes ?? '';
		ring = polygonToRing(garden.boundary);
		draftSource = garden.boundary_source;
		parcelNote = '';
		drawing = false;
	}

	function startCreate() {
		editing = null;
		creating = true;
		draftName = '';
		draftNotes = '';
		ring = [];
		draftSource = 'drawn';
		parcelNote = '';
		drawing = false;
	}

	function cancel() {
		editing = null;
		creating = false;
		drawing = false;
		ring = [];
		draftSource = 'drawn';
		parcelNote = '';
	}

	const area = $derived(ring.length >= 3 ? ringAreaHectares(ring) : 0);
	const perimeter = $derived(ring.length >= 3 ? ringPerimeterMeters(ring) : 0);

	/**
	 * Any hand edit demotes the boundary to 'drawn'. A registered outline with
	 * one corner nudged is no longer the register's outline, and the whole
	 * value of `boundary_source` is that it never overstates what it describes.
	 */
	function handEdited() {
		draftSource = 'drawn';
		parcelNote = '';
	}

	function addVertex(lat: number, lon: number) {
		ring = [...ring, [lon, lat]];
		handEdited();
	}

	function moveVertex(index: number, lat: number, lon: number) {
		ring = ring.map((point, i) => (i === index ? ([lon, lat] as [number, number]) : point));
		handEdited();
	}

	function undo() {
		ring = ring.slice(0, -1);
		handEdited();
	}

	function clearRing() {
		ring = [];
		handEdited();
	}

	/**
	 * The boundary is a single Polygon, so a property spread over several
	 * detached parcels contributes its largest one — and says so, rather than
	 * silently dropping the rest.
	 */
	function useParcel(result: ParcelResult) {
		ring = result.parcels[0].ring;
		draftSource = 'mml';
		drawing = false;
		if (!draftName.trim()) draftName = result.presentation;
		parcelNote = result.parcels.length > 1 ? t.property.useLargest : t.property.boundarySet;
		mapView?.fitToRing(ring);
	}

	async function save() {
		if (!draftName.trim()) return;
		busy = true;
		error = '';

		const boundary = ringToPolygon(ring);
		// A drawn boundary knows where its own middle is; without one, fall back
		// to whatever centre the garden already had.
		const centre = boundary ? ringCentroid(ring) : null;

		const values = {
			name: draftName.trim(),
			notes: draftNotes.trim() || null,
			boundary,
			boundary_source: boundary ? draftSource : 'drawn',
			center_lat: centre ? centre[1] : (editing?.center_lat ?? null),
			center_lon: centre ? centre[0] : (editing?.center_lon ?? null)
		};

		try {
			if (editing) {
				const { error: err } = await supabase.from('gardens').update(values).eq('id', editing.id);
				if (err) throw err;
			} else {
				const { data, error: err } = await supabase
					.from('gardens')
					.insert({ ...values, sort_order: gardens.all.length })
					.select('id')
					.single();
				if (err) throw err;
				await load();
				gardens.select(data.id);
			}
			await load();
			cancel();
			flash(t.common.saved);
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	async function remove(garden: Garden) {
		if (counts[garden.id]) {
			error = t.garden.cannotDelete;
			return;
		}
		if (!confirm(t.common.confirmDelete)) return;
		await supabase.from('gardens').delete().eq('id', garden.id);
		await load();
	}

	function useCurrentPosition() {
		if (!geo.fix || !editing) return;
		supabase
			.from('gardens')
			.update({ center_lat: geo.fix.lat, center_lon: geo.fix.lon })
			.eq('id', editing.id)
			.then(() => load());
	}

	const here = $derived(geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null);
	const editorOpen = $derived(Boolean(editing) || creating);
</script>

<svelte:head><title>{t.garden.many} — {t.app.name}</title></svelte:head>

<div class="section">
	<div class="head">
		<div>
			<p class="eyebrow"><a href="/rekisteri">{t.registry.title}</a></p>
			<h1>{t.garden.many}</h1>
		</div>
		{#if !editorOpen}
			<button class="btn btn-primary" type="button" onclick={startCreate}>{t.garden.new}</button>
		{/if}
	</div>

	{#if error}<p class="notice notice-error">{error}</p>{/if}
	{#if message}<p class="notice notice-ok">{message}</p>{/if}

	{#if editorOpen}
		<section class="editor">
			<div class="fields">
				<div class="field">
					<label for="garden-name">{t.garden.name}</label>
					<input id="garden-name" bind:value={draftName} required placeholder="Arboretum" />
				</div>
				<div class="field">
					<label for="garden-notes">{t.garden.notes}</label>
					<textarea id="garden-notes" bind:value={draftNotes} rows="2"></textarea>
				</div>
			</div>

			<div class="boundary">
				<PropertyLookup onfound={useParcel} {busy} />

				{#if parcelNote}
					<p class="notice notice-ok small">{parcelNote}</p>
				{/if}

				<div class="boundary-bar">
					{#if drawing}
						<button class="btn btn-sm btn-primary" type="button" onclick={() => (drawing = false)}>
							{t.garden.finish}
						</button>
						<button class="btn btn-sm" type="button" onclick={undo} disabled={!ring.length}>
							{t.garden.undo}
						</button>
						<button class="btn btn-sm" type="button" onclick={clearRing} disabled={!ring.length}>
							{t.garden.clear}
						</button>
					{:else}
						<button class="btn btn-sm" type="button" onclick={() => (drawing = true)}>
							{ring.length ? t.garden.redraw : t.garden.draw}
						</button>
					{/if}

					<span class="data muted stats">
						{t.garden.corners(ring.length)}
						{#if area}
							· {t.garden.area} {t.garden.hectares(area)} · {t.garden.perimeter}
							{Math.round(perimeter)} m
						{/if}
						{#if ring.length}
							· {t.garden.boundarySources[draftSource]}
						{/if}
					</span>
				</div>

				{#if drawing}
					<p class="hint">{t.garden.drawHelp}</p>
				{/if}

				<div class="map-box">
					<MapView
						bind:this={mapView}
						garden={editing}
						{drawing}
						{ring}
						{here}
						onvertexadd={addVertex}
						onvertexmove={moveVertex}
					/>
				</div>
			</div>

			<div class="row actions">
				<button class="btn btn-primary" type="button" onclick={save} disabled={busy || !draftName.trim()}>
					{busy ? t.common.saving : t.common.save}
				</button>
				<button class="btn" type="button" onclick={cancel}>{t.common.cancel}</button>
				{#if editing && here}
					<button class="btn btn-sm" type="button" onclick={useCurrentPosition}>
						{t.garden.centerFromHere}
					</button>
				{/if}
			</div>
		</section>
	{/if}

	{#if !gardens.all.length && gardens.loaded}
		<p class="empty">{t.garden.noneHelp}</p>
	{:else}
		<ul class="gardens">
			{#each gardens.all as garden (garden.id)}
				{@const gardenRing = polygonToRing(garden.boundary)}
				<li class="card" class:active={gardens.active?.id === garden.id}>
					<div class="garden-head">
						<div>
							<h2>{garden.name}</h2>
							{#if garden.notes}<p class="muted small">{garden.notes}</p>{/if}
						</div>
						{#if gardens.active?.id !== garden.id}
							<button class="btn btn-sm" type="button" onclick={() => gardens.select(garden.id)}>
								{t.garden.switch}
							</button>
						{:else}
							<span class="badge">Valittuna</span>
						{/if}
					</div>

					<dl class="facts">
						<div>
							<dt>{t.garden.plantingCount}</dt>
							<dd class="data">{counts[garden.id] ?? 0}</dd>
						</div>
						<div>
							<dt>{t.garden.area}</dt>
							<dd class="data">
								{gardenRing.length >= 3 ? t.garden.hectares(ringAreaHectares(gardenRing)) : '—'}
							</dd>
						</div>
						<div>
							<dt>{t.garden.boundarySource}</dt>
							<dd>{t.garden.boundarySources[garden.boundary_source]}</dd>
						</div>
					</dl>

					{#if !garden.boundary}
						<p class="notice small">{t.garden.boundaryNone}</p>
					{:else if garden.boundary_source === 'drawn'}
						<p class="notice warn small">{t.garden.drawnWarning}</p>
					{/if}

					<div class="row">
						<button class="btn btn-sm" type="button" onclick={() => startEdit(garden)}>
							{t.common.edit}
						</button>
						<button class="btn btn-sm btn-danger" type="button" onclick={() => remove(garden)}>
							{t.common.delete}
						</button>
					</div>
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
		margin-bottom: 1rem;
	}

	.small {
		font-size: 0.8125rem;
	}

	.editor {
		border: 1px solid var(--hairline-strong);
		border-left: 3px solid var(--moss);
		border-radius: var(--radius);
		background: var(--paper-raised);
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.fields {
		display: grid;
		gap: 0 0.75rem;
		grid-template-columns: 1fr;
	}

	.boundary-bar {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 0.5rem;
	}

	.stats {
		margin-left: auto;
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--ink-soft);
		margin: 0 0 0.5rem;
		padding-left: 0.6rem;
		border-left: 2px solid var(--lichen);
	}

	.map-box {
		height: 22rem;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.actions {
		margin-top: 0.9rem;
		flex-wrap: wrap;
	}

	.gardens {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}

	.gardens li.active {
		border-left: 3px solid var(--moss);
	}

	.garden-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.garden-head h2 {
		margin: 0;
	}

	.garden-head p {
		margin: 0.15rem 0 0;
	}

	.badge {
		font-family: var(--font-data);
		font-size: 0.6875rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--moss);
		border: 1px solid color-mix(in oklab, var(--moss) 50%, transparent);
		border-radius: 2px;
		padding: 0.15rem 0.4rem;
		white-space: nowrap;
	}

	.facts {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		margin: 0 0 0.75rem;
	}

	dt {
		font-family: var(--font-data);
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--bark);
	}

	dd {
		margin: 0.1rem 0 0;
		font-size: 0.9375rem;
	}

	.notice.warn {
		border-left: 3px solid var(--lichen);
		margin-bottom: 0.75rem;
	}

	.notice.small {
		margin-bottom: 0.75rem;
	}

	@media (min-width: 42rem) {
		.fields {
			grid-template-columns: 1fr 2fr;
		}
	}
</style>
