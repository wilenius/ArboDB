<script lang="ts">
	/**
	 * Drawing the plot's furniture onto the aerial photo.
	 *
	 * Two ways in, and the second is the one that matters. Tracing on the
	 * imagery works for a lawn edge or a driveway, but a path under a closed
	 * canopy is simply not in the picture, and a stone wall is a line of stones
	 * the size of the photo's pixels. So a feature can also be recorded by
	 * walking it: stand at each corner, tap once. The phone knows where it is
	 * standing far better than the photograph does.
	 */
	import MapView from '$lib/components/MapView.svelte';
	import { fetchFeatures, fetchMapLayers } from '$lib/data';
	import { FEATURE_STYLE } from '$lib/features';
	import { gardens } from '$lib/gardens.svelte';
	import { geo } from '$lib/geolocation.svelte';
	import {
		lineLengthMeters,
		ringAreaHectares,
		ringPerimeterMeters,
		ringToPolygon,
		type Ring
	} from '$lib/geo';
	import { supabase, session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import { onDestroy, onMount } from 'svelte';
	import { FEATURE_SHAPES, type FeatureKind, type MapFeature, type MapLayer } from '$lib/types';

	let features = $state<MapFeature[]>([]);
	let layers = $state<MapLayer[]>([]);
	let error = $state('');
	let message = $state('');
	let busy = $state(false);

	// Draft being drawn
	let editing = $state<MapFeature | null>(null);
	let drawing = $state(false);
	let ring = $state<Ring>([]);
	let name = $state('');
	let kind = $state<FeatureKind>('path');
	let notes = $state('');
	let shape = $state<'line' | 'polygon'>('line');

	onMount(() => geo.start());
	onDestroy(() => geo.stop());

	$effect(() => {
		if (!$session || !gardens.loaded) return;
		void gardens.active?.id;
		load();
	});

	async function load() {
		try {
			[features, layers] = await Promise.all([
				fetchFeatures(gardens.active?.id),
				fetchMapLayers()
			]);
			error = '';
		} catch {
			error = t.errors.load;
		}
	}

	function startNew() {
		editing = null;
		ring = [];
		name = '';
		notes = '';
		kind = 'path';
		shape = FEATURE_SHAPES.path;
		drawing = true;
		message = '';
	}

	function startEdit(feature: MapFeature) {
		editing = feature;
		name = feature.name ?? '';
		notes = feature.notes ?? '';
		kind = feature.kind;
		shape = feature.geometry.type === 'Polygon' ? 'polygon' : 'line';
		ring =
			feature.geometry.type === 'Polygon'
				? // A stored ring repeats its first point to close; the editor works
					// with the open list and closes again on save.
					feature.geometry.coordinates[0].slice(0, -1)
				: [...feature.geometry.coordinates];
		drawing = true;
		message = '';
	}

	function cancel() {
		drawing = false;
		editing = null;
		ring = [];
	}

	/** Changing the kind moves the default shape with it, unless points exist. */
	function pickKind(next: FeatureKind) {
		kind = next;
		if (!ring.length) shape = FEATURE_SHAPES[next];
	}

	function addVertex(lat: number, lon: number) {
		ring = [...ring, [lon, lat]];
	}

	function moveVertex(index: number, lat: number, lon: number) {
		ring = ring.map((p, i) => (i === index ? ([lon, lat] as [number, number]) : p));
	}

	function addPointHere() {
		if (!geo.fix) return;
		addVertex(geo.fix.lat, geo.fix.lon);
	}

	const enoughPoints = $derived(shape === 'polygon' ? ring.length >= 3 : ring.length >= 2);

	const measurement = $derived.by(() => {
		if (shape === 'polygon' && ring.length >= 3) {
			return `${t.feature.area} ${t.garden.hectares(ringAreaHectares(ring))} · ${t.feature.length} ${t.feature.meters(ringPerimeterMeters(ring))}`;
		}
		if (ring.length >= 2) {
			return `${t.feature.length} ${t.feature.meters(lineLengthMeters(ring))}`;
		}
		return null;
	});

	async function save() {
		if (!enoughPoints || !gardens.active) return;
		busy = true;
		try {
			const geometry =
				shape === 'polygon'
					? ringToPolygon(ring)
					: { type: 'LineString' as const, coordinates: ring };

			const values = {
				garden_id: gardens.active.id,
				name: name.trim() || null,
				kind,
				geometry,
				notes: notes.trim() || null
			};

			const { error: err } = editing
				? await supabase.from('features').update(values).eq('id', editing.id)
				: await supabase.from('features').insert(values);
			if (err) throw err;

			message = t.feature.saved;
			cancel();
			await load();
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	async function toggleVisible(feature: MapFeature) {
		await supabase.from('features').update({ visible: !feature.visible }).eq('id', feature.id);
		await load();
	}

	async function remove(feature: MapFeature) {
		if (!confirm(t.common.confirmDelete)) return;
		await supabase.from('features').delete().eq('id', feature.id);
		if (editing?.id === feature.id) cancel();
		await load();
	}

	function summarise(feature: MapFeature): string {
		if (feature.geometry.type === 'Polygon') {
			const r = feature.geometry.coordinates[0].slice(0, -1);
			return `${t.garden.hectares(ringAreaHectares(r))}`;
		}
		return t.feature.meters(lineLengthMeters(feature.geometry.coordinates));
	}

	// While drawing, the feature under the pen is left out of the painted set so
	// the draft is not shadowed by the saved version of itself.
	const painted = $derived(
		drawing && editing ? features.filter((f) => f.id !== editing!.id) : features
	);

	const here = $derived(geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null);
</script>

<svelte:head><title>{t.feature.many} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow"><a href="/kartta">{t.map.title}</a></p>
	<div class="head">
		<div>
			<h1>{t.feature.title}</h1>
			<p class="lead">{t.feature.lead}</p>
		</div>
		{#if !drawing}
			<button class="btn btn-primary" type="button" onclick={startNew}>{t.feature.new}</button>
		{/if}
	</div>

	<nav class="subnav no-print">
		<a href="/kartta">{t.map.title}</a>
		<a href="/kartta/kohteet" aria-current="page">{t.feature.many}</a>
		<a href="/kartta/tasot">{t.map.importedLayers}</a>
	</nav>

	{#if error}<p class="notice notice-error">{error}</p>{/if}
	{#if message}<p class="notice notice-ok">{message}</p>{/if}

	<div class="map-wrap">
		<MapView
			features={painted}
			{layers}
			{here}
			garden={gardens.active}
			{drawing}
			{ring}
			drawShape={shape}
			drawInto="feature"
			onvertexadd={addVertex}
			onvertexmove={moveVertex}
		/>
	</div>

	{#if drawing}
		<section class="editor">
			<p class="hint">{t.feature.drawHelp}</p>
			<p class="hint">{t.feature.walkHelp}</p>

			<div class="row wrap">
				<button
					class="btn btn-sm btn-primary"
					type="button"
					onclick={addPointHere}
					disabled={!geo.fix}
				>
					{t.feature.addPointHere}
				</button>
				<button
					class="btn btn-sm"
					type="button"
					disabled={!ring.length}
					onclick={() => (ring = ring.slice(0, -1))}
				>
					{t.feature.undo}
				</button>
				<button class="btn btn-sm" type="button" disabled={!ring.length} onclick={() => (ring = [])}>
					{t.feature.clear}
				</button>
				<span class="data muted">{t.feature.points(ring.length)}</span>
				{#if measurement}<span class="data measurement">{measurement}</span>{/if}
			</div>

			<div class="field-grid">
				<div class="field">
					<label for="f-name">{t.feature.name}</label>
					<input id="f-name" bind:value={name} placeholder={t.feature.namePlaceholder} />
				</div>
				<div class="field">
					<label for="f-kind">{t.feature.kind}</label>
					<select
						id="f-kind"
						value={kind}
						onchange={(e) => pickKind(e.currentTarget.value as FeatureKind)}
					>
						{#each Object.entries(t.feature.kinds) as [value, label] (value)}
							<option {value}>{label}</option>
						{/each}
					</select>
				</div>
				<div class="field">
					<label for="f-shape">{t.feature.shape}</label>
					<select id="f-shape" bind:value={shape}>
						<option value="line">{t.feature.shapes.line}</option>
						<option value="polygon">{t.feature.shapes.polygon}</option>
					</select>
				</div>
			</div>

			<div class="field">
				<label for="f-notes">{t.feature.notes}</label>
				<input id="f-notes" bind:value={notes} />
			</div>

			{#if !enoughPoints}
				<p class="hint">{t.feature.needsPoints}</p>
			{/if}

			<div class="row">
				<button
					class="btn btn-primary"
					type="button"
					onclick={save}
					disabled={busy || !enoughPoints}
				>
					{busy ? t.common.saving : t.common.save}
				</button>
				<button class="btn" type="button" onclick={cancel}>{t.common.cancel}</button>
			</div>
		</section>
	{/if}

	<section class="list">
		<h2>{t.feature.many}</h2>
		{#if !features.length}
			<p class="empty">{t.feature.none}</p>
		{:else}
			<ul>
				{#each features as feature (feature.id)}
					<li class:hidden-feature={!feature.visible}>
						<span class="swatch" style="background: {FEATURE_STYLE[feature.kind].color}"></span>
						<span class="what">
							<span class="f-name">{feature.name || t.feature.kinds[feature.kind]}</span>
							<span class="f-meta data">
								{t.feature.kinds[feature.kind]} · {summarise(feature)}
							</span>
							{#if feature.notes}<span class="f-notes">{feature.notes}</span>{/if}
						</span>
						<span class="f-actions no-print">
							<!-- Labelled with what the click does, not with the current
							     state: a button reading "Kyllä" that hides the thing is a
							     coin toss every time. -->
							<button class="btn btn-sm" type="button" onclick={() => toggleVisible(feature)}>
								{feature.visible ? t.feature.hide : t.feature.show}
							</button>
							<button class="btn btn-sm" type="button" onclick={() => startEdit(feature)}>
								{t.common.edit}
							</button>
							<button class="btn btn-sm btn-danger" type="button" onclick={() => remove(feature)}>
								{t.common.delete}
							</button>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.lead {
		max-width: 52ch;
		color: var(--ink-soft);
		margin-top: 0;
	}

	.map-wrap {
		height: min(60vh, 30rem);
		margin: 1rem 0;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.editor {
		border: 1px solid var(--hairline);
		border-left: 3px solid var(--moss);
		border-radius: var(--radius);
		padding: 0.9rem 1rem 0.1rem;
		margin-bottom: 1.5rem;
		background: var(--paper-raised);
	}

	.hint {
		font-size: 0.8125rem;
		color: var(--bark);
		margin: 0 0 0.6rem;
		max-width: 60ch;
	}

	.row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.9rem;
	}

	.wrap {
		flex-wrap: wrap;
	}

	.measurement {
		font-size: 0.8125rem;
		color: var(--moss);
	}

	.list ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.5rem;
	}

	.list li {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
	}

	.hidden-feature {
		opacity: 0.5;
	}

	/* The swatch is the map's own line colour, so the list and the picture can
	   be matched up without reading either. */
	.swatch {
		flex: none;
		width: 0.75rem;
		height: 1.4rem;
		border-radius: 1px;
		margin-top: 0.1rem;
	}

	.what {
		flex: 1;
		display: grid;
		gap: 0.1rem;
		min-width: 0;
	}

	.f-meta {
		font-size: 0.75rem;
		color: var(--bark);
	}

	.f-notes {
		font-size: 0.8125rem;
		color: var(--ink-soft);
	}

	.f-actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
</style>
