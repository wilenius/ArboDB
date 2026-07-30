<script lang="ts">
	/**
	 * Quick capture: the record started standing next to the tree.
	 *
	 * Everything here is optional except the position, and deliberately so. The
	 * expensive fields in the field are the ones that need a keyboard and a
	 * reference book — species, provenance, sizes — and a form that insists on
	 * them is a form that gets skipped, which is how plantings end up
	 * unrecorded. So the phone captures what only the phone can (where you are
	 * standing, and a photo), marks the record unfinished, and hands it back at
	 * a desk through the registry's worklist.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { fetchTaxa } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { geo } from '$lib/geolocation.svelte';
	import { scientificName } from '$lib/format';
	import { uploadPhoto } from '$lib/photos';
	import { supabase, session } from '$lib/supabase';
	import { t } from '$lib/i18n';
	import type { Taxon } from '$lib/types';

	let taxa = $state<Taxon[]>([]);
	let taxonQuery = $state('');
	let taxonId = $state('');
	let note = $state('');
	let provisional = $state(false);
	let file = $state<File | null>(null);

	let busy = $state(false);
	let error = $state('');
	let saved = $state<{ id: string; code: string } | null>(null);

	onMount(() => {
		geo.start();
	});
	onDestroy(() => geo.stop());

	$effect(() => {
		if ($session && !taxa.length) void loadTaxa();
	});

	async function loadTaxa() {
		try {
			taxa = await fetchTaxa();
		} catch {
			// A missing taxon list is not worth blocking the capture over; the
			// species can be filled in later either way.
		}
	}

	const matches = $derived(
		taxonQuery.trim()
			? taxa.filter((x) => {
					const q = taxonQuery.toLowerCase();
					return (
						scientificName(x).toLowerCase().includes(q) ||
						(x.name_fi ?? '').toLowerCase().includes(q)
					);
				})
			: taxa
	);

	async function save() {
		const fix = geo.fix;
		if (!fix || !gardens.active) {
			error = t.quick.needsFix;
			return;
		}

		busy = true;
		error = '';
		try {
			const { data, error: err } = await supabase
				.from('plantings')
				.insert({
					garden_id: gardens.active.id,
					taxon_id: taxonId || null,
					// The common case by far is a seedling going in today; a record of
					// an older tree can have the year corrected at the desk, which is
					// also where the accession code was going to be checked anyway.
					planted_year: new Date().getFullYear(),
					planted_month: new Date().getMonth() + 1,
					count_planted: 1,
					lat: fix.lat,
					lon: fix.lon,
					notes: note.trim() || null,
					incomplete: true
				})
				.select('id, accession_code')
				.single();
			if (err) throw err;

			// The insert trigger has already logged the position as a placement;
			// only the provisional flag has to be said out loud.
			if (provisional) {
				await supabase
					.from('placements')
					.update({ provisional: true, accuracy_m: fix.accuracy, source: 'gps' })
					.eq('planting_id', data.id)
					.is('tree_id', null);
			}

			if (file) {
				const uploaded = await uploadPhoto(file, `plantings/${data.id}`);
				await supabase.from('photos').insert({ planting_id: data.id, ...uploaded });
			}

			saved = { id: data.id, code: data.accession_code ?? '—' };
		} catch {
			error = t.errors.save;
		} finally {
			busy = false;
		}
	}

	function again() {
		saved = null;
		taxonId = '';
		taxonQuery = '';
		note = '';
		provisional = false;
		file = null;
	}
</script>

<svelte:head><title>{t.quick.title} — {t.app.name}</title></svelte:head>

<div class="section narrow">
	<p class="eyebrow"><a href="/">{t.nearby.title}</a></p>
	<h1>{t.quick.title}</h1>

	{#if saved}
		<p class="notice notice-ok">{t.quick.saved(saved.code)}</p>
		<div class="actions">
			<button class="btn btn-primary" type="button" onclick={again}>{t.quick.another}</button>
			<a class="btn" href="/istutus/{saved.id}">{t.quick.openRecord}</a>
			<a class="btn" href="/">{t.common.back}</a>
		</div>
	{:else}
		<p class="lead">{t.quick.lead}</p>

		{#if error}<p class="notice notice-error">{error}</p>{/if}

		<!-- The fix leads, because it is the one thing that cannot be done later
		     and the one thing worth waiting a few seconds for. -->
		<div class="fix" data-state={geo.fix ? 'ok' : geo.error ? 'error' : 'waiting'}>
			{#if geo.fix}
				<p class="fix-reading data">{geo.fix.lat.toFixed(5)}, {geo.fix.lon.toFixed(5)}</p>
				<p class="fix-meta data">
					{t.quick.positionFrom} · {t.nearby.accuracy} ±{Math.round(geo.fix.accuracy)} m
				</p>
			{:else if geo.error}
				<p class="fix-meta">{t.nearby.locationDenied}</p>
				<button class="btn btn-sm" type="button" onclick={() => geo.start()}>
					{t.nearby.retry}
				</button>
			{:else}
				<p class="fix-meta">{t.quick.waiting}</p>
			{/if}
		</div>

		<div class="field">
			<label for="quick-note">{t.quick.noteLabel}</label>
			<textarea
				id="quick-note"
				bind:value={note}
				rows="3"
				placeholder={t.quick.notePlaceholder}
			></textarea>
		</div>

		<div class="field">
			<label for="quick-photo">{t.quick.photo}</label>
			<input
				id="quick-photo"
				type="file"
				accept="image/*"
				capture="environment"
				onchange={(e) => (file = e.currentTarget.files?.[0] ?? null)}
			/>
		</div>

		<details class="more">
			<summary>{t.quick.taxonOptional}</summary>
			<div class="field">
				<label for="quick-taxon-q">{t.quick.taxonSearch}</label>
				<input id="quick-taxon-q" type="search" bind:value={taxonQuery} />
			</div>
			<div class="field">
				<label for="quick-taxon">{t.taxon.one}</label>
				<select id="quick-taxon" bind:value={taxonId}>
					<option value="">{t.quick.noTaxon}</option>
					{#each matches as taxon (taxon.id)}
						<option value={taxon.id}>
							{scientificName(taxon)}{taxon.name_fi ? ` — ${taxon.name_fi}` : ''}
						</option>
					{/each}
				</select>
			</div>
		</details>

		<label class="check">
			<input type="checkbox" bind:checked={provisional} />
			<span>
				{t.quick.provisionalHere}
				<em>{t.placement.provisionalHelp}</em>
			</span>
		</label>

		<button
			class="btn btn-primary btn-block save"
			type="button"
			onclick={save}
			disabled={busy || !geo.fix || !gardens.active}
		>
			{busy ? t.quick.saving : t.quick.save}
		</button>
	{/if}
</div>

<style>
	.lead {
		color: var(--ink-soft);
		max-width: 44ch;
	}

	.fix {
		padding: 0.85rem 1rem;
		margin: 0 0 1.25rem;
		border: 1px solid var(--hairline);
		border-left: 3px solid var(--bark);
		border-radius: var(--radius);
		background: var(--paper-raised);
	}

	.fix[data-state='ok'] {
		border-left-color: var(--moss);
	}

	.fix-reading {
		margin: 0;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
	}

	.fix-meta {
		margin: 0.15rem 0 0;
		font-size: 0.8125rem;
		color: var(--bark);
	}

	.more {
		margin: 0 0 0.85rem;
	}

	.more summary {
		font-family: var(--font-data);
		font-size: 0.6875rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--bark);
		cursor: pointer;
		padding: 0.35rem 0;
	}

	.save {
		margin-top: 1rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}
</style>
