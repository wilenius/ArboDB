<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Plate from '$lib/components/Plate.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { buildTargets, fetchMapLayers, fetchPlantings, targetKey } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { geo } from '$lib/geolocation.svelte';
	import { install } from '$lib/install.svelte';
	import { bearingDegrees, compassPoint } from '$lib/geo';
	import { formatDistance } from '$lib/format';
	import { t } from '$lib/i18n';
	import { session } from '$lib/supabase';
	import type { MapLayer, Planting, Target } from '$lib/types';

	let plantings = $state<Planting[]>([]);
	let layers = $state<MapLayer[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let showAll = $state(false);
	let query = $state('');

	onMount(() => {
		geo.start();
	});
	onDestroy(() => geo.stop());

	$effect(() => {
		// Re-reads when the active garden changes, so switching plots reloads.
		if (!$session || !gardens.loaded) return;
		void gardens.active?.id;
		load();
	});

	async function load() {
		loading = true;
		try {
			[plantings, layers] = await Promise.all([
				fetchPlantings(gardens.active?.id),
				fetchMapLayers()
			]);
			loadError = '';
		} catch {
			loadError = t.errors.load;
		} finally {
			loading = false;
		}
	}

	const here = $derived(geo.fix ? { lat: geo.fix.lat, lon: geo.fix.lon } : null);
	const allTargets = $derived(buildTargets(plantings, here));

	const filtered = $derived(
		query.trim()
			? allTargets.filter((x) => {
					const q = query.toLowerCase();
					const tx = x.planting.taxa;
					return (
						(tx?.name_fi ?? '').toLowerCase().includes(q) ||
						(tx?.genus ?? '').toLowerCase().includes(q) ||
						(tx?.species ?? '').toLowerCase().includes(q) ||
						(x.planting.accession_code ?? '').toLowerCase().includes(q)
					);
				})
			: allTargets
	);

	const visible = $derived(showAll || query.trim() ? filtered : filtered.slice(0, 8));
	const nearest = $derived(here && filtered[0]?.distance_m != null ? filtered[0] : null);
	const rest = $derived(nearest ? visible.slice(1) : visible);

	const bearing = $derived(
		nearest && here && nearest.lat != null && nearest.lon != null
			? bearingDegrees(here.lat, here.lon, nearest.lat, nearest.lon)
			: null
	);

	function newObservationHref(target: Target) {
		return target.kind === 'tree'
			? `/havainto/uusi?tree=${target.tree!.id}`
			: `/havainto/uusi?planting=${target.planting.id}`;
	}
</script>

<svelte:head><title>{t.nav.nearby} — {t.app.name}</title></svelte:head>

<div class="section">
	<!-- The hero is the fix itself: where you are, how well the phone knows it.
	     Everything below is ordered by that one number. -->
	<div class="fix" data-state={geo.fix ? 'ok' : geo.error ? 'error' : 'waiting'}>
		<div class="fix-main">
			<p class="eyebrow">{t.nearby.title}</p>
			{#if geo.fix}
				<p class="fix-reading data">
					{geo.fix.lat.toFixed(5)}, {geo.fix.lon.toFixed(5)}
				</p>
				<p class="fix-accuracy data">
					{t.nearby.accuracy} ±{Math.round(geo.fix.accuracy)} m
				</p>
			{:else if geo.error}
				<p class="fix-note">{t.nearby.locationDenied}</p>
				<button class="btn btn-sm" type="button" onclick={() => geo.start()}>
					{t.nearby.retry}
				</button>
			{:else}
				<p class="fix-note">{t.nearby.locating}</p>
			{/if}
		</div>

		{#if bearing != null && nearest}
			<!-- Distance and heading to the nearest tree: the one number worth
			     reading at arm's length in bright sun. -->
			<a class="dial" href={nearest.kind === 'tree' ? `/puu/${nearest.tree!.id}` : `/istutus/${nearest.planting.id}`}>
				<span class="needle" style="transform: rotate({bearing}deg)" aria-hidden="true">↑</span>
				<span class="dial-distance data">{formatDistance(nearest.distance_m)}</span>
				<span class="dial-compass data">{compassPoint(bearing)}</span>
			</a>
		{/if}
	</div>

	{#if loadError}
		<p class="notice notice-error">{loadError}</p>
	{/if}

	<!-- Shown only where it can actually be acted on, and only until dismissed:
	     field mode is the one screen the owner opens every time, so it is the
	     one place the hint reaches him before he has an icon to tap. -->
	{#if install.offerable && !install.dismissed}
		<div class="install-hint no-print">
			<span>{t.install.hint}</span>
			<a class="btn btn-sm" href="/asenna">{t.install.hintAction}</a>
			<button class="btn btn-sm" type="button" onclick={() => install.dismiss()}>
				{t.install.dismiss}
			</button>
		</div>
	{/if}

	<div class="map-strip">
		<MapView
			targets={allTargets}
			{layers}
			{here}
			garden={gardens.active}
			selectedKey={nearest ? targetKey(nearest) : null}
		/>
	</div>

	<div class="search-row no-print">
		<input
			type="search"
			bind:value={query}
			placeholder={t.common.search}
			aria-label={t.common.search}
		/>
		<a class="btn btn-primary" href="/havainto/uusi">{t.observation.new}</a>
		<a class="btn" href="/istutus/pika">{t.nearby.quickAdd}</a>
	</div>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !allTargets.length}
		<p class="empty">{t.nearby.noPositions}</p>
	{:else}
		<div class="results">
			{#if nearest}
				<div class="at-hand">
					<p class="eyebrow">Lähin</p>
					<Plate target={nearest} />
					<a class="btn btn-primary btn-block quick" href={newObservationHref(nearest)}>
						{t.observation.new}
					</a>
				</div>
			{/if}

			<ul class="plates">
				{#each rest as target (targetKey(target))}
					<li><Plate {target} /></li>
				{/each}
			</ul>

			{#if !query.trim() && filtered.length > visible.length}
				<button class="btn btn-block" type="button" onclick={() => (showAll = true)}>
					{t.nearby.showAll} ({filtered.length})
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.install-hint {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.75rem 0 0;
		padding: 0.6rem 0.75rem;
		border: 1px solid var(--hairline);
		border-left: 3px solid var(--moss);
		border-radius: var(--radius);
		background: var(--paper-raised);
		font-size: 0.875rem;
	}

	.install-hint span {
		flex: 1 1 12rem;
	}

	.fix {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.85rem 0 1rem;
		border-bottom: 1px solid var(--hairline);
	}

	.fix-main {
		min-width: 0;
	}

	.fix-reading {
		font-size: 1.05rem;
		margin: 0;
		letter-spacing: -0.02em;
	}

	.fix-accuracy {
		margin: 0.1rem 0 0;
		color: var(--bark);
	}

	.fix-note {
		margin: 0 0 0.5rem;
		font-size: 0.875rem;
		color: var(--bark);
		max-width: 26rem;
	}

	/* A survey dial rather than a card: needle, distance, compass point. */
	.dial {
		flex: none;
		width: 5.5rem;
		height: 5.5rem;
		border-radius: 50%;
		border: 1px solid var(--hairline-strong);
		display: grid;
		place-items: center;
		grid-template-areas: 'stack';
		text-decoration: none;
		color: var(--ink);
		background: radial-gradient(
			circle at 50% 40%,
			color-mix(in oklab, var(--moss) 12%, transparent),
			transparent 70%
		);
		position: relative;
	}

	.needle {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: start center;
		padding-top: 0.3rem;
		font-size: 1.15rem;
		color: var(--lichen);
		transform-origin: 50% 50%;
		transition: transform 0.4s ease;
	}

	.dial-distance {
		grid-area: stack;
		font-size: 1.05rem;
		font-weight: 500;
		letter-spacing: -0.02em;
	}

	.dial-compass {
		position: absolute;
		bottom: 0.5rem;
		font-size: 0.6875rem;
		color: var(--bark);
		letter-spacing: 0.1em;
	}

	.map-strip {
		height: 12rem;
		margin: 1rem 0;
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.search-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.search-row input {
		flex: 1;
		min-width: 0;
	}

	.search-row .btn {
		flex: none;
	}

	.at-hand {
		margin-bottom: 1.25rem;
	}

	.at-hand :global(.plate) {
		padding: 1.05rem 1.1rem 1rem;
	}

	.at-hand :global(.plate .sci) {
		font-size: 1.3rem;
	}

	.quick {
		margin-top: 0.5rem;
	}

	.plates {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	@media (min-width: 48rem) {
		.map-strip {
			height: 16rem;
		}

		.plates {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
		}
	}
</style>
