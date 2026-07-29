<script lang="ts">
	import { fetchMapLayers } from '$lib/data';
	import { supabase, session, publicUrl } from '$lib/supabase';
	import {
		geoJsonBounds,
		parseWorldFile,
		reprojectGeoJson,
		worldFileCorners
	} from '$lib/geo';
	import { t } from '$lib/i18n';
	import PropertyLookup from '$lib/components/PropertyLookup.svelte';
	import type { ParcelResult } from '$lib/mml';
	import type { MapLayer } from '$lib/types';

	let layers = $state<MapLayer[]>([]);
	let busy = $state(false);
	let message = $state('');
	let error = $state('');

	// Import form
	let name = $state('');
	let dataFile = $state<File | null>(null);
	let worldFile = $state<File | null>(null);
	let crs = $state<'auto' | 'tm35fin' | 'wgs84'>('auto');
	let manualBounds = $state({ west: '', south: '', east: '', north: '' });

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		try {
			layers = await fetchMapLayers();
		} catch {
			error = t.errors.load;
		}
	}

	const isImage = $derived(Boolean(dataFile && /\.(png|jpe?g|webp)$/i.test(dataFile.name)));
	const isGeoJson = $derived(Boolean(dataFile && /\.(geo)?json$/i.test(dataFile.name)));

	function readImageSize(file: File): Promise<{ w: number; h: number }> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				resolve({ w: img.naturalWidth, h: img.naturalHeight });
				URL.revokeObjectURL(url);
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('image'));
			};
			img.src = url;
		});
	}

	async function importLayer(e: SubmitEvent) {
		e.preventDefault();
		if (!dataFile) return;
		busy = true;
		error = '';
		message = '';

		try {
			if (isGeoJson) {
				const raw = JSON.parse(await dataFile.text());
				// Finnish GIS exports come in ETRS-TM35FIN; MapLibre wants WGS84.
				const geojson = crs === 'wgs84' ? raw : reprojectGeoJson(raw);
				if (!geoJsonBounds(geojson)) throw new Error(t.errors.noGeometry);

				const { error: err } = await supabase.from('map_layers').insert({
					name: name || dataFile.name,
					kind: 'geojson',
					geojson,
					sort_order: layers.length
				});
				if (err) throw err;
			} else if (isImage) {
				const { w, h } = await readImageSize(dataFile);
				let corners: [number, number][];

				if (worldFile) {
					const wf = parseWorldFile(await worldFile.text());
					if (!wf) throw new Error(t.errors.fileType);
					corners = worldFileCorners(wf, w, h, crs === 'wgs84' ? 'wgs84' : 'tm35fin');
				} else {
					const west = parseFloat(manualBounds.west);
					const south = parseFloat(manualBounds.south);
					const east = parseFloat(manualBounds.east);
					const north = parseFloat(manualBounds.north);
					if ([west, south, east, north].some((n) => !Number.isFinite(n))) {
						throw new Error(t.errors.noGeometry);
					}
					// MapLibre image sources take corners clockwise from top-left.
					corners = [
						[west, north],
						[east, north],
						[east, south],
						[west, south]
					];
				}

				const path = `layers/${Date.now()}-${dataFile.name.replace(/[^\w.-]/g, '_')}`;
				const { error: upErr } = await supabase.storage
					.from('maps')
					.upload(path, dataFile, { contentType: dataFile.type, upsert: false });
				if (upErr) throw upErr;

				const { error: err } = await supabase.from('map_layers').insert({
					name: name || dataFile.name,
					kind: 'image',
					storage_path: path,
					bounds: corners.flat(),
					sort_order: layers.length
				});
				if (err) throw err;
			} else {
				throw new Error(t.errors.fileType);
			}

			message = t.map.imported;
			name = '';
			dataFile = null;
			worldFile = null;
			manualBounds = { west: '', south: '', east: '', north: '' };
			(e.target as HTMLFormElement).reset();
			await load();
		} catch (err) {
			error = err instanceof Error ? err.message : t.errors.generic;
		} finally {
			busy = false;
		}
	}

	/**
	 * A property fetched from the register becomes an ordinary GeoJSON layer —
	 * the same row shape as an imported file, so it draws, hides and fades like
	 * everything else. The identifier is the name; there is nothing better to
	 * call it, and it is what the owner will look for.
	 */
	async function importProperty(result: ParcelResult) {
		busy = true;
		error = '';
		message = '';
		try {
			const { error: err } = await supabase.from('map_layers').insert({
				name: `${t.property.code} ${result.presentation}`,
				kind: 'geojson',
				geojson: result.geojson,
				sort_order: layers.length
			});
			if (err) throw err;
			message = t.map.imported;
			await load();
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	async function update(layer: MapLayer, patch: Partial<MapLayer>) {
		await supabase.from('map_layers').update(patch).eq('id', layer.id);
		await load();
	}

	async function remove(layer: MapLayer) {
		if (!confirm(t.common.confirmDelete)) return;
		if (layer.storage_path) await supabase.storage.from('maps').remove([layer.storage_path]);
		await supabase.from('map_layers').delete().eq('id', layer.id);
		await load();
	}
</script>

<svelte:head><title>{t.map.layers} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow"><a href="/kartta">{t.map.title}</a> / {t.map.layers}</p>
	<h1>{t.map.layers}</h1>

	{#if message}<p class="notice notice-ok">{message}</p>{/if}
	{#if error}<p class="notice notice-error">{error}</p>{/if}

	<section class="card import">
		<h2>{t.property.title}</h2>
		<PropertyLookup onfound={importProperty} {busy} />
		<p class="muted small boundary-hint">
			{t.property.asBoundary}: <a href="/puutarhat">{t.garden.manage}</a>
		</p>
	</section>

	<section class="card import">
		<h2>{t.map.addLayer}</h2>
		<p class="muted small">{t.map.geojsonHelp}</p>
		<p class="muted small">{t.map.imageHelp}</p>

		<form onsubmit={importLayer}>
			<div class="field">
				<label for="layer-name">{t.map.layerName}</label>
				<input id="layer-name" bind:value={name} placeholder="Ortoilmakuva 2024" />
			</div>

			<div class="field">
				<label for="layer-file">{t.map.layerFile}</label>
				<input
					id="layer-file"
					type="file"
					accept=".geojson,.json,.png,.jpg,.jpeg,.webp"
					onchange={(e) => (dataFile = e.currentTarget.files?.[0] ?? null)}
					required
				/>
			</div>

			{#if isImage}
				<div class="field">
					<label for="world-file">{t.map.worldFile}</label>
					<input
						id="world-file"
						type="file"
						accept=".jgw,.pgw,.tfw,.wld,.txt"
						onchange={(e) => (worldFile = e.currentTarget.files?.[0] ?? null)}
					/>
				</div>
			{/if}

			{#if isImage || isGeoJson}
				<div class="field">
					<label for="crs">{t.map.crs}</label>
					<select id="crs" bind:value={crs}>
						<option value="auto">Tunnista automaattisesti</option>
						<option value="tm35fin">ETRS-TM35FIN (EPSG:3067)</option>
						<option value="wgs84">WGS84 (EPSG:4326)</option>
					</select>
				</div>
			{/if}

			{#if isImage && !worldFile}
				<fieldset class="bounds">
					<legend class="field-label">{t.map.bounds} (WGS84)</legend>
					<div class="field-grid">
						<div class="field">
							<label for="b-north">{t.map.north}</label>
							<input id="b-north" inputmode="decimal" bind:value={manualBounds.north} placeholder="60.3320" />
						</div>
						<div class="field">
							<label for="b-south">{t.map.south}</label>
							<input id="b-south" inputmode="decimal" bind:value={manualBounds.south} placeholder="60.3295" />
						</div>
						<div class="field">
							<label for="b-west">{t.map.west}</label>
							<input id="b-west" inputmode="decimal" bind:value={manualBounds.west} placeholder="24.6610" />
						</div>
						<div class="field">
							<label for="b-east">{t.map.east}</label>
							<input id="b-east" inputmode="decimal" bind:value={manualBounds.east} placeholder="24.6675" />
						</div>
					</div>
				</fieldset>
			{/if}

			<button class="btn btn-primary" type="submit" disabled={busy || !dataFile}>
				{busy ? t.common.saving : t.map.addLayer}
			</button>
		</form>
	</section>

	<h2 class="list-heading">{t.map.importedLayers}</h2>
	{#if !layers.length}
		<p class="empty">{t.map.noLayers}</p>
	{:else}
		<ul class="layers">
			{#each layers as layer (layer.id)}
				<li class="card layer">
					<div class="layer-head">
						<div>
							<strong>{layer.name}</strong>
							<span class="data muted">{layer.kind === 'image' ? 'kuva' : 'geojson'}</span>
						</div>
						<button class="btn btn-sm btn-danger" type="button" onclick={() => remove(layer)}>
							{t.common.delete}
						</button>
					</div>

					{#if layer.kind === 'image' && layer.storage_path}
						<img class="preview" src={publicUrl('maps', layer.storage_path)} alt="" />
					{/if}

					<div class="layer-controls">
						<label class="inline">
							<input
								type="checkbox"
								checked={layer.visible}
								onchange={(e) => update(layer, { visible: e.currentTarget.checked })}
							/>
							{t.map.visible}
						</label>
						<label class="inline range">
							{t.map.opacity}
							<input
								type="range"
								min="0.1"
								max="1"
								step="0.05"
								value={layer.opacity}
								onchange={(e) => update(layer, { opacity: Number(e.currentTarget.value) })}
							/>
						</label>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.small {
		font-size: 0.8125rem;
	}

	.import {
		margin: 1rem 0 1.5rem;
	}

	.import h2 {
		margin-bottom: 0.4rem;
	}

	.boundary-hint {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
	}

	.bounds {
		border: 1px solid var(--hairline);
		border-radius: var(--radius);
		padding: 0.7rem 0.8rem 0.1rem;
		margin: 0 0 0.85rem;
	}

	.list-heading {
		margin-bottom: 0.6rem;
	}

	.layers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.6rem;
		grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
	}

	.layer-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.layer-head .data {
		margin-left: 0.4rem;
	}

	.preview {
		width: 100%;
		height: 7rem;
		object-fit: cover;
		border-radius: 2px;
		border: 1px solid var(--hairline);
		margin: 0.6rem 0;
		display: block;
	}

	.layer-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1rem;
		margin-top: 0.6rem;
	}

	.inline {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0;
		text-transform: none;
		letter-spacing: 0;
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--ink);
	}

	.inline input[type='checkbox'] {
		width: auto;
	}

	.range input[type='range'] {
		width: 7rem;
		min-height: 0;
		padding: 0;
		accent-color: var(--moss);
	}
</style>
