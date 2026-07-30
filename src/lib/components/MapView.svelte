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
	import { colorByKind, DASHED_KINDS, widthByKind } from '$lib/features';
	import { ringToPolygon, type Ring } from '$lib/geo';
	import { t } from '$lib/i18n';
	import type { Garden, MapFeature, MapLayer, Target } from '$lib/types';

	let {
		targets = [],
		layers = [],
		features = [],
		editable = false,
		here = null,
		selectedKey = null,
		garden = null,
		drawing = false,
		drawShape = 'polygon',
		drawInto = 'boundary',
		ring = [],
		onmove,
		onselect,
		onvertexadd,
		onvertexmove
	}: {
		targets?: Target[];
		layers?: MapLayer[];
		/** Hand-drawn paths, walls, lawns and fences. */
		features?: MapFeature[];
		editable?: boolean;
		here?: { lat: number; lon: number; accuracy?: number } | null;
		selectedKey?: string | null;
		/** Opens the map here and outlines the plot. */
		garden?: Garden | null;
		/** Drawing: tap to drop a vertex, drag a vertex to adjust. */
		drawing?: boolean;
		/** A wall is a chain, a lawn is a ring; only the ring closes. */
		drawShape?: 'polygon' | 'line';
		/** Whether the ring being edited replaces the plot outline or is a feature. */
		drawInto?: 'boundary' | 'feature';
		ring?: Ring;
		onmove?: (target: Target, lat: number, lon: number) => void;
		onselect?: (target: Target) => void;
		onvertexadd?: (lat: number, lon: number) => void;
		onvertexmove?: (index: number, lat: number, lon: number) => void;
	} = $props();

	let container: HTMLDivElement;
	let map: MlMap | undefined = $state();
	let ready = $state(false);
	let basemap = $state<BasemapId>(DEFAULT_BASEMAP);
	let markers: Marker[] = [];
	let vertexMarkers: Marker[] = [];
	let hereMarker: Marker | undefined;

	const positioned = $derived(targets.filter((x) => x.lat != null && x.lon != null));

	onMount(() => {
		// The garden decides where the map opens; the env vars are only the
		// fallback for a database with no garden centred yet.
		const centreLon = garden?.center_lon ?? Number(PUBLIC_MAP_CENTER_LON) ?? 24.6641;
		const centreLat = garden?.center_lat ?? Number(PUBLIC_MAP_CENTER_LAT) ?? 60.3308;

		map = new maplibregl.Map({
			container,
			style: buildStyle(basemap),
			center: [centreLon, centreLat],
			zoom: garden?.default_zoom ?? Number(PUBLIC_MAP_ZOOM) ?? 17,
			maxZoom: 21,
			attributionControl: { compact: true }
		});
		map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

		// Everything of ours goes on once the style exists. Note that inside this
		// handler isStyleLoaded() can still report false while sources finish
		// loading, so it must not be used as a gate — adding sources and layers
		// here is legal, and gating on it silently skips the first paint.
		map.on('load', () => {
			ready = true;
			repaint();
			fitToContent();
		});

		map.on('click', (e) => {
			if (drawing) onvertexadd?.(e.lngLat.lat, e.lngLat.lng);
		});

	});

	/** Everything this component draws on top of the basemap. */
	function repaint() {
		if (!map || !ready) return;
		paintLayers();
		paintFeatures();
		paintBoundary();
		syncMarkers();
	}

	onDestroy(() => {
		markers.forEach((m) => m.remove());
		vertexMarkers.forEach((m) => m.remove());
		hereMarker?.remove();
		map?.remove();
	});

	/**
	 * A style swap wipes every source and layer we added, so put them back once
	 * the new style has settled. 'idle' is the reliable signal — 'styledata'
	 * fires repeatedly and can arrive before the old style is torn down.
	 */
	function setBasemap(id: BasemapId) {
		basemap = id;
		if (!map) return;
		map.setStyle(buildStyle(id));
		map.once('idle', () => repaint());
	}

	// --- imported layers ---------------------------------------------------

	function paintLayers() {
		if (!map || !map.getStyle()) return;

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
					paint: { 'fill-color': '#7fc4e0', 'fill-opacity': 0.12 * layer.opacity }
				});
				map.addLayer({
					id: `${sourceId}-line`,
					type: 'line',
					source: sourceId,
					paint: {
						'line-color': '#7fc4e0',
						'line-width': 2,
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

	// --- drawn features ------------------------------------------------------

	/**
	 * Paths, walls, lawns, fences. One source for all of them, with the colour
	 * chosen by `kind` through a match expression — but two line layers, because
	 * `line-dasharray` is the one property MapLibre will not vary per feature.
	 */
	function paintFeatures() {
		if (!map || !map.getStyle()) return;

		const data = {
			type: 'FeatureCollection' as const,
			features: features
				.filter((f) => f.visible && f.geometry)
				.map((f) => ({
					type: 'Feature' as const,
					properties: { kind: f.kind, name: f.name ?? '' },
					geometry: f.geometry
				}))
		};

		const existing = map.getSource('features') as maplibregl.GeoJSONSource | undefined;
		if (existing) {
			existing.setData(data as never);
			return;
		}

		map.addSource('features', { type: 'geojson', data: data as never });

		map.addLayer({
			id: 'features-fill',
			type: 'fill',
			source: 'features',
			filter: ['==', ['geometry-type'], 'Polygon'],
			paint: { 'fill-color': colorByKind() as never, 'fill-opacity': 0.22 }
		});

		map.addLayer({
			id: 'features-line-solid',
			type: 'line',
			source: 'features',
			filter: ['!', ['in', ['get', 'kind'], ['literal', DASHED_KINDS]]],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': colorByKind() as never,
				'line-width': widthByKind() as never
			}
		});

		map.addLayer({
			id: 'features-line-dashed',
			type: 'line',
			source: 'features',
			filter: ['in', ['get', 'kind'], ['literal', DASHED_KINDS]],
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: {
				'line-color': colorByKind() as never,
				'line-width': widthByKind() as never,
				'line-dasharray': [2, 1.5]
			}
		});

		// Names ride along the line itself, the way a path is labelled on a
		// walking map. Glyphs come from a CDN, so a failure here costs the
		// labels and nothing else.
		map.addLayer({
			id: 'features-label',
			type: 'symbol',
			source: 'features',
			filter: ['!=', ['get', 'name'], ''],
			layout: {
				'text-field': ['get', 'name'],
				'text-font': ['Noto Sans Regular'],
				'text-size': 11,
				'symbol-placement': 'line-center',
				'text-max-angle': 40
			},
			paint: {
				'text-color': '#f2f4ee',
				'text-halo-color': '#16241c',
				'text-halo-width': 1.4
			}
		});
	}

	/**
	 * The feature being drawn right now. Separate from the boundary preview so a
	 * wall can be traced without the plot outline flickering out from under it.
	 */
	function paintDraft() {
		if (!map || !map.getStyle()) return;

		const live =
			drawInto === 'feature' && ring.length >= 2
				? {
						type: 'Feature' as const,
						properties: {},
						geometry:
							drawShape === 'polygon' && ring.length >= 3
								? (ringToPolygon(ring) as never)
								: ({ type: 'LineString', coordinates: ring } as never)
					}
				: null;

		const data = live ?? { type: 'FeatureCollection' as const, features: [] };

		const existing = map.getSource('feature-draft') as maplibregl.GeoJSONSource | undefined;
		if (existing) {
			existing.setData(data as never);
			return;
		}

		map.addSource('feature-draft', { type: 'geojson', data: data as never });
		map.addLayer({
			id: 'feature-draft-fill',
			type: 'fill',
			source: 'feature-draft',
			filter: ['==', ['geometry-type'], 'Polygon'],
			paint: { 'fill-color': '#f2f4ee', 'fill-opacity': 0.15 }
		});
		map.addLayer({
			id: 'feature-draft-line',
			type: 'line',
			source: 'feature-draft',
			layout: { 'line-cap': 'round', 'line-join': 'round' },
			paint: { 'line-color': '#f2f4ee', 'line-width': 2.5 }
		});
	}

	// --- garden boundary ---------------------------------------------------

	/**
	 * The plot outline. While drawing, the ring being edited wins over the
	 * stored boundary so the owner sees exactly what will be saved.
	 */
	function paintBoundary() {
		if (!map || !map.getStyle()) return;

		const live =
			drawInto === 'boundary' && (drawing || ring.length) ? ringToPolygon(ring) : null;
		const geometry = live ?? garden?.boundary ?? null;

		const data = geometry
			? { type: 'Feature' as const, properties: {}, geometry: geometry as never }
			: { type: 'FeatureCollection' as const, features: [] };

		const existing = map.getSource('garden-boundary') as maplibregl.GeoJSONSource | undefined;
		if (existing) {
			existing.setData(data as never);
		} else {
			map.addSource('garden-boundary', { type: 'geojson', data: data as never });
			map.addLayer({
				id: 'garden-boundary-fill',
				type: 'fill',
				source: 'garden-boundary',
				paint: { 'fill-color': '#e8c46a', 'fill-opacity': 0.07 }
			});
			map.addLayer({
				id: 'garden-boundary-line',
				type: 'line',
				source: 'garden-boundary',
				paint: {
					'line-color': '#e8c46a',
					'line-width': 2,
					'line-dasharray': [3, 2]
				}
			});
		}

		// While drawing, an open chain of two points has no polygon to fill, so
		// draw the chain itself or the first segment vanishes.
		const chain =
			drawInto === 'boundary' && drawing && ring.length >= 2
				? {
						type: 'Feature' as const,
						properties: {},
						geometry: { type: 'LineString' as const, coordinates: ring }
					}
				: { type: 'FeatureCollection' as const, features: [] };

		const chainSource = map.getSource('garden-chain') as maplibregl.GeoJSONSource | undefined;
		if (chainSource) {
			chainSource.setData(chain as never);
		} else {
			map.addSource('garden-chain', { type: 'geojson', data: chain as never });
			map.addLayer({
				id: 'garden-chain-line',
				type: 'line',
				source: 'garden-chain',
				paint: { 'line-color': '#e8c46a', 'line-width': 2 }
			});
		}

		paintDraft();
		syncVertices();
	}

	/** Corner handles, draggable so a rough outline can be nudged into shape. */
	function syncVertices() {
		if (!map) return;
		vertexMarkers.forEach((m) => m.remove());
		vertexMarkers = [];
		if (!drawing) return;

		vertexMarkers = ring.map(([lon, lat], index) => {
			const el = document.createElement('div');
			el.className = 'vertex-marker';
			el.setAttribute('aria-label', `${t.garden.corner} ${index + 1}`);
			const marker = new maplibregl.Marker({ element: el, draggable: true })
				.setLngLat([lon, lat])
				.addTo(map!);
			marker.on('dragend', () => {
				const { lng, lat: newLat } = marker.getLngLat();
				onvertexmove?.(index, newLat, lng);
			});
			return marker;
		});
	}

	/** Batch plantings have no individual trees, only a centroid and a radius. */
	function paintAreas() {
		if (!map || !map.getStyle()) return;
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
		// Re-read every reactive input so this runs when any of them change.
		void positioned;
		void editable;
		void selectedKey;
		void ring;
		void drawing;
		void garden;
		void layers;
		void features;
		void drawShape;
		void drawInto;
		if (ready) repaint();
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

	function fitToCoords(coords: [number, number][], duration = 0) {
		if (!map || coords.length < 2) return;
		const bounds = coords.reduce(
			(b, c) => b.extend(c),
			new maplibregl.LngLatBounds(coords[0], coords[0])
		);
		map.fitBounds(bounds, { padding: 60, maxZoom: 18, duration });
	}

	function fitToContent() {
		// Prefer the plot outline: it is the answer to "show me the garden",
		// whereas the specimens only cover wherever planting has happened.
		const boundaryRing = garden?.boundary?.coordinates?.[0];
		fitToCoords(
			boundaryRing && boundaryRing.length >= 3
				? (boundaryRing as [number, number][])
				: positioned.map((x) => [x.lon!, x.lat!] as [number, number])
		);
	}

	/**
	 * Frame a ring the caller has just produced. A boundary fetched from the
	 * property register can be nowhere near where the map happens to be
	 * pointing, and an outline off-screen reads as a lookup that did nothing.
	 */
	export function fitToRing(target: Ring) {
		fitToCoords(target, 600);
	}

	export function flyTo(lat: number, lon: number, zoom = 19) {
		map?.flyTo({ center: [lon, lat], zoom, duration: 600 });
	}

	function locate() {
		if (here) flyTo(here.lat, here.lon, 19);
	}
</script>

<div class="map-wrap" class:drawing>
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

	/* Crosshair says "this click places a corner", not "this pans the map". */
	.drawing :global(.maplibregl-canvas-container) {
		cursor: crosshair;
	}

	/* Specimen markers must not swallow clicks meant for the outline. */
	.drawing :global(.tree-marker) {
		pointer-events: none;
		opacity: 0.55;
	}

	:global(.vertex-marker) {
		width: 15px;
		height: 15px;
		border-radius: 50%;
		background: #e8c46a;
		border: 2px solid #14241c;
		box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.8);
		cursor: grab;
	}

	:global(.vertex-marker:active) {
		cursor: grabbing;
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
