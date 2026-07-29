<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import maplibregl, { type Map as MlMap, type Marker } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';
	import {
		PUBLIC_MAP_CENTER_LAT,
		PUBLIC_MAP_CENTER_LON,
		PUBLIC_MAP_ZOOM
	} from '$env/static/public';
	import { availableBasemaps, buildStyle, DEFAULT_BASEMAP, hasMml, type BasemapId } from '$lib/basemaps';
	import { publicUrl } from '$lib/supabase';
	import { scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { MapLayer, Target } from '$lib/types';

	let {
		targets = [],
		layers = [],
		editable = false,
		here = null,
		selectedKey = null,
		onmove,
		onselect
	}: {
		targets?: Target[];
		layers?: MapLayer[];
		editable?: boolean;
		here?: { lat: number; lon: number; accuracy?: number } | null;
		selectedKey?: string | null;
		onmove?: (target: Target, lat: number, lon: number) => void;
		onselect?: (target: Target) => void;
	} = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined = $state();
	let ready = $state(false);
	let basemap = $state<BasemapId>(DEFAULT_BASEMAP);
	let markers: Marker[] = [];
	let hereMarker: Marker | undefined;

	const positioned = $derived(targets.filter((x) => x.lat != null && x.lon != null));

	onMount(() => {
		map = new maplibregl.Map({
			container,
			style: buildStyle(basemap),
			center: [Number(PUBLIC_MAP_CENTER_LON) || 24.6641, Number(PUBLIC_MAP_CENTER_LAT) || 60.3308],
			zoom: Number(PUBLIC_MAP_ZOOM) || 17,
			maxZoom: 21,
			attributionControl: { compact: true }
		});
		map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

		map.on('load', () => {
			ready = true;
			paintLayers();
			fitToContent();
		});

		// A style swap wipes every source and layer, so put ours back afterwards.
		map.on('styledata', () => {
			if (ready) paintLayers();
		});
	});

	onDestroy(() => {
		markers.forEach((m) => m.remove());
		hereMarker?.remove();
		map?.remove();
	});

	function setBasemap(id: BasemapId) {
		basemap = id;
		map?.setStyle(buildStyle(id));
	}

	// --- imported layers ---------------------------------------------------

	function paintLayers() {
		if (!map || !map.isStyleLoaded()) return;

		for (const layer of layers) {
			if (!layer.visible) continue;
			const sourceId = `import-${layer.id}`;
			if (map.getSource(sourceId)) continue;

			if (layer.kind === 'geojson' && layer.geojson) {
				map.addSource(sourceId, { type: 'geojson', data: layer.geojson as never });
				map.addLayer({
					id: `${sourceId}-fill`,
					type: 'fill',
					source: sourceId,
					filter: ['==', ['geometry-type'], 'Polygon'],
					paint: { 'fill-color': '#b8862b', 'fill-opacity': 0.1 * layer.opacity }
				});
				map.addLayer({
					id: `${sourceId}-line`,
					type: 'line',
					source: sourceId,
					paint: {
						'line-color': '#e8c46a',
						'line-width': 2,
						'line-dasharray': [3, 2],
						'line-opacity': layer.opacity
					}
				});
			} else if (layer.kind === 'image' && layer.storage_path && layer.bounds?.length === 8) {
				const b = layer.bounds;
				map.addSource(sourceId, {
					type: 'image',
					url: publicUrl('maps', layer.storage_path)!,
					coordinates: [
						[b[0], b[1]],
						[b[2], b[3]],
						[b[4], b[5]],
						[b[6], b[7]]
					]
				});
				map.addLayer({
					id: `${sourceId}-raster`,
					type: 'raster',
					source: sourceId,
					paint: { 'raster-opacity': layer.opacity }
				});
			}
		}

		paintAreas();
	}

	/** Batch plantings have no individual trees, only a centroid and a radius. */
	function paintAreas() {
		if (!map) return;
		const features = positioned
			.filter((x) => x.kind === 'planting' && x.planting.radius_m)
			.map((x) => ({
				type: 'Feature' as const,
				properties: { name: x.planting.accession_code },
				geometry: {
					type: 'Polygon' as const,
					coordinates: [circle(x.lon!, x.lat!, x.planting.radius_m!)]
				}
			}));

		const data = { type: 'FeatureCollection' as const, features };
		const src = map.getSource('planting-areas') as maplibregl.GeoJSONSource | undefined;
		if (src) {
			src.setData(data);
			return;
		}
		map.addSource('planting-areas', { type: 'geojson', data });
		map.addLayer({
			id: 'planting-areas-fill',
			type: 'fill',
			source: 'planting-areas',
			paint: { 'fill-color': '#7fae86', 'fill-opacity': 0.14 }
		});
		map.addLayer({
			id: 'planting-areas-line',
			type: 'line',
			source: 'planting-areas',
			paint: { 'line-color': '#7fae86', 'line-width': 1.5, 'line-opacity': 0.7 }
		});
	}

	function circle(lon: number, lat: number, radiusM: number, steps = 48): [number, number][] {
		const dLat = radiusM / 111320;
		const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
		const ring: [number, number][] = [];
		for (let i = 0; i <= steps; i++) {
			const θ = (i / steps) * 2 * Math.PI;
			ring.push([lon + dLon * Math.cos(θ), lat + dLat * Math.sin(θ)]);
		}
		return ring;
	}

	// --- markers -----------------------------------------------------------

	function markerElement(target: Target): HTMLElement {
		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'tree-marker';
		const status = target.tree?.status ?? (target.planting.status === 'active' ? 'alive' : target.planting.status);
		el.dataset.status = status;
		el.dataset.kind = target.kind;
		if (target.planting.origin_type === 'original') el.dataset.original = 'true';

		const name = target.planting.taxa?.name_fi ?? scientificName(target.planting.taxa);
		const label = target.tree?.label ? ` ${target.tree.label}` : '';
		el.setAttribute('aria-label', `${name}${label}`);
		el.innerHTML = `<span class="dot"></span><span class="cap">${target.planting.accession_code ?? ''}${label}</span>`;
		return el;
	}

	function syncMarkers() {
		if (!map || !ready) return;
		markers.forEach((m) => m.remove());
		markers = positioned.map((target) => {
			const el = markerElement(target);
			const key = target.kind === 'tree' ? `tree:${target.tree!.id}` : `planting:${target.planting.id}`;
			if (key === selectedKey) el.dataset.selected = 'true';

			const marker = new maplibregl.Marker({ element: el, draggable: editable })
				.setLngLat([target.lon!, target.lat!])
				.addTo(map!);

			el.addEventListener('click', (e) => {
				e.stopPropagation();
				onselect?.(target);
			});

			if (editable) {
				marker.on('dragend', () => {
					const { lng, lat } = marker.getLngLat();
					onmove?.(target, lat, lng);
				});
			}
			return marker;
		});
		paintAreas();
	}

	$effect(() => {
		// Re-read the reactive inputs so this runs when any of them change.
		void positioned;
		void editable;
		void selectedKey;
		if (ready) syncMarkers();
	});

	$effect(() => {
		if (!map || !ready) return;
		if (!here) {
			hereMarker?.remove();
			hereMarker = undefined;
			return;
		}
		if (!hereMarker) {
			const el = document.createElement('div');
			el.className = 'here-marker';
			el.innerHTML = '<span class="pulse"></span><span class="core"></span>';
			hereMarker = new maplibregl.Marker({ element: el }).setLngLat([here.lon, here.lat]).addTo(map);
		} else {
			hereMarker.setLngLat([here.lon, here.lat]);
		}
	});

	function fitToContent() {
		if (!map) return;
		const coords = positioned.map((x) => [x.lon!, x.lat!] as [number, number]);
		if (coords.length < 2) return;
		const bounds = coords.reduce(
			(b, c) => b.extend(c),
			new maplibregl.LngLatBounds(coords[0], coords[0])
		);
		map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 0 });
	}

	export function flyTo(lat: number, lon: number, zoom = 19) {
		map?.flyTo({ center: [lon, lat], zoom, duration: 600 });
	}

	function locate() {
		if (here) flyTo(here.lat, here.lon, 19);
	}
</script>

<div class="map-wrap">
	<div class="map" bind:this={container}></div>

	<div class="basemap-switch no-print" role="group" aria-label={t.map.basemap}>
		{#each availableBasemaps() as b (b.id)}
			<button
				type="button"
				class="swatch"
				data-active={basemap === b.id}
				onclick={() => setBasemap(b.id)}
			>
				{t.map[b.id]}
			</button>
		{/each}
		{#if here}
			<button type="button" class="swatch" onclick={locate} title={t.map.locate}>◎</button>
		{/if}
	</div>

	{#if !hasMml}
		<p class="mml-hint no-print">{t.map.mmlMissing}</p>
	{/if}
</div>

<style>
	.map-wrap {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 20rem;
	}

	.map {
		position: absolute;
		inset: 0;
	}

	/* Four basemaps do not fit across a phone, so the strip scrolls sideways
	   rather than running under the zoom controls. */
	.basemap-switch {
		position: absolute;
		left: 0.6rem;
		top: 0.6rem;
		max-width: calc(100% - 3.6rem);
		display: flex;
		gap: 1px;
		background: var(--hairline-strong);
		border: 1px solid var(--hairline-strong);
		border-radius: var(--radius);
		overflow-x: auto;
		scrollbar-width: none;
		z-index: 2;
	}

	.basemap-switch::-webkit-scrollbar {
		display: none;
	}

	.swatch {
		border: 0;
		background: var(--paper-raised);
		color: var(--ink);
		font-family: var(--font-data);
		font-size: 0.6875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.45rem 0.6rem;
		cursor: pointer;
		white-space: nowrap;
		flex: none;
	}

	.swatch[data-active='true'] {
		background: var(--moss);
		color: #f4f8f0;
	}

	.mml-hint {
		position: absolute;
		left: 0.6rem;
		right: 0.6rem;
		bottom: 2.2rem;
		margin: 0;
		z-index: 2;
		font-size: 0.75rem;
		line-height: 1.35;
		background: color-mix(in oklab, var(--paper-raised) 92%, transparent);
		border: 1px solid var(--hairline-strong);
		border-left: 3px solid var(--lichen);
		border-radius: var(--radius);
		padding: 0.5rem 0.6rem;
		color: var(--ink-soft);
	}

	/* Markers are created imperatively, so their styles have to be global. */
	:global(.tree-marker) {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		font-family: var(--font-data);
	}

	:global(.tree-marker .dot) {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #7fae86;
		border: 2px solid #14241c;
		box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.75);
		transition: transform 0.12s ease;
	}

	:global(.tree-marker[data-kind='planting'] .dot) {
		border-radius: 2px;
		transform: rotate(45deg);
	}

	:global(.tree-marker[data-status='dead'] .dot) {
		background: #c9614f;
	}

	:global(.tree-marker[data-status='removed'] .dot) {
		background: #8d8676;
	}

	:global(.tree-marker[data-original='true'] .dot) {
		background: #d9ac52;
	}

	:global(.tree-marker[data-selected='true'] .dot) {
		transform: scale(1.5);
		box-shadow: 0 0 0 3px rgba(216, 172, 82, 0.9);
	}

	:global(.tree-marker:hover .dot) {
		transform: scale(1.3);
	}

	:global(.tree-marker .cap) {
		font-size: 9.5px;
		letter-spacing: 0.03em;
		color: #f2f6ec;
		background: rgba(20, 36, 28, 0.82);
		padding: 0 3px;
		border-radius: 2px;
		white-space: nowrap;
		opacity: 0;
		transition: opacity 0.12s ease;
	}

	:global(.tree-marker:hover .cap),
	:global(.tree-marker[data-selected='true'] .cap) {
		opacity: 1;
	}

	:global(.here-marker) {
		position: relative;
		width: 18px;
		height: 18px;
	}

	:global(.here-marker .core) {
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: #4b7f9c;
		border: 2px solid #fff;
	}

	:global(.here-marker .pulse) {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: rgba(75, 127, 156, 0.35);
		animation: here-pulse 2.4s ease-out infinite;
	}

	@keyframes here-pulse {
		0% {
			transform: scale(0.6);
			opacity: 0.9;
		}
		100% {
			transform: scale(2.4);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.here-marker .pulse) {
			animation: none;
		}
	}
</style>
