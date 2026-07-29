<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import MapView from '$lib/components/MapView.svelte';
	import Plate from '$lib/components/Plate.svelte';
	import { buildTargets, fetchMapLayers, fetchPlantings, targetKey } from '$lib/data';
	import { geo } from '$lib/geolocation.svelte';
	import { supabase, session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { MapLayer, Planting, Target } from '$lib/types';

	let plantings = $state<Planting[]>([]);
	let layers = $state<MapLayer[]>([]);
	let editable = $state(false);
	let selected = $state<Target | null>(null);
	let toast = $state('');
	let loadError = $state('');

	onMount(() => geo.start());
	onDestroy(() => geo.stop());

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		try {
			[plantings, layers] = await Promise.all([fetchPlantings(), fetchMapLayers()]);
			loadError = '';
		} catch {
			loadError = t.errors.load;
		}
	}

	const here = $derived(geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null);
	const targets = $derived(buildTargets(plantings, here));

	/**
	 * Dragging is the fix for GPS scatter under a canopy, so a drag is a
	 * deliberate correction: it saves immediately and flips the position source
	 * from 'gps' to 'manual' so the origin of every coordinate stays honest.
	 */
	async function moved(target: Target, lat: number, lon: number) {
		try {
			if (target.kind === 'tree') {
				const { error } = await supabase
					.from('trees')
					.update({ lat, lon, position_source: 'manual', position_accuracy_m: null })
					.eq('id', target.tree!.id);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('plantings')
					.update({ lat, lon })
					.eq('id', target.planting.id);
				if (error) throw error;
			}
			toast = t.map.moved;
			setTimeout(() => (toast = ''), 2000);
			await load();
		} catch {
			toast = t.errors.save;
		}
	}
</script>

<svelte:head><title>{t.map.title} — {t.app.name}</title></svelte:head>

<div class="map-page">
	<div class="map-area">
		<MapView
			{targets}
			{layers}
			{here}
			{editable}
			selectedKey={selected ? targetKey(selected) : null}
			onmove={moved}
			onselect={(x) => (selected = x)}
		/>

		{#if toast}
			<p class="toast" role="status">{toast}</p>
		{/if}
	</div>

	<aside class="panel">
		{#if loadError}
			<p class="notice notice-error">{loadError}</p>
		{/if}

		<div class="panel-actions">
			<button
				class="btn btn-sm"
				class:btn-primary={editable}
				type="button"
				onclick={() => (editable = !editable)}
			>
				{editable ? t.map.doneEditing : t.map.editPositions}
			</button>
			<a class="btn btn-sm" href="/kartta/tasot">{t.map.layers}</a>
		</div>

		{#if editable}
			<p class="hint">{t.map.dragHelp}</p>
		{/if}

		{#if selected}
			<div class="selected">
				<Plate target={selected} />
				<a
					class="btn btn-sm btn-block"
					href={selected.kind === 'tree'
						? `/havainto/uusi?tree=${selected.tree!.id}`
						: `/havainto/uusi?planting=${selected.planting.id}`}
				>
					{t.observation.new}
				</a>
			</div>
		{:else}
			<p class="hint muted">Napauta merkkiä nähdäksesi puun tiedot.</p>
		{/if}

		<hr class="rule" />

		<p class="eyebrow">Merkkien selitteet</p>
		<ul class="legend">
			<li><span class="key alive"></span> Elossa</li>
			<li><span class="key dead"></span> Kuollut</li>
			<li><span class="key removed"></span> Poistettu</li>
			<li><span class="key original"></span> Alkuperäinen puusto</li>
			<li><span class="key batch"></span> Erä ilman yksilöitä</li>
		</ul>
	</aside>
</div>

<style>
	.map-page {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - 7.5rem);
	}

	.map-area {
		position: relative;
		flex: 1;
		min-height: 14rem;
	}

	.toast {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		z-index: 5;
		margin: 0;
		padding: 0.45rem 0.8rem;
		border-radius: 999px;
		background: var(--moss);
		color: #f4f8f0;
		font-size: 0.8125rem;
	}

	.panel {
		flex: none;
		padding: 0.85rem var(--rail) 1rem;
		border-top: 1px solid var(--hairline);
		background: var(--paper);
		overflow-y: auto;
		max-height: 45%;
	}

	.panel-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.6rem;
	}

	.hint {
		font-size: 0.8125rem;
		margin: 0 0 0.6rem;
		color: var(--ink-soft);
	}

	.selected {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.legend {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 1rem;
		font-size: 0.8125rem;
		color: var(--bark);
	}

	.legend li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.key {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		border: 2px solid var(--ink);
		flex: none;
	}

	.alive {
		background: #7fae86;
	}
	.dead {
		background: #c9614f;
	}
	.removed {
		background: #8d8676;
	}
	.original {
		background: #d9ac52;
	}
	.batch {
		background: #7fae86;
		border-radius: 2px;
		transform: rotate(45deg);
	}

	@media (min-width: 60rem) {
		.map-page {
			flex-direction: row;
			height: calc(100dvh - 6.5rem);
		}

		.panel {
			width: 22rem;
			flex: none;
			max-height: none;
			border-top: 0;
			border-left: 1px solid var(--hairline);
		}
	}
</style>
