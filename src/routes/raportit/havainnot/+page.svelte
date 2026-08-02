<script lang="ts">
	import ObservationCard from '$lib/components/ObservationCard.svelte';
	import TagChip from '$lib/components/TagChip.svelte';
	import { fetchObservations, fetchTags } from '$lib/data';
	import { gardens } from '$lib/gardens.svelte';
	import { session } from '$lib/supabase';
	import { scientificName } from '$lib/format';
	import { t } from '$lib/i18n';
	import type { Observation, ObservationKind, Tag } from '$lib/types';

	let observations = $state<Observation[]>([]);
	let tags = $state<Tag[]>([]);
	let loading = $state(true);

	let from = $state('');
	let to = $state('');
	let kind = $state<ObservationKind | ''>('');
	let activeTags = $state<Set<string>>(new Set());
	let taxonQuery = $state('');

	$effect(() => {
		if ($session) load();
	});

	async function load() {
		[observations, tags] = await Promise.all([
			fetchObservations({ gardenId: gardens.active?.id }),
			fetchTags()
		]);
		loading = false;
	}

	function toggleTag(id: string) {
		const next = new Set(activeTags);
		next.has(id) ? next.delete(id) : next.add(id);
		activeTags = next;
	}

	const filtered = $derived(
		observations.filter((o) => {
			if (kind && o.kind !== kind) return false;
			if (from && o.observed_at < new Date(from).toISOString()) return false;
			if (to && o.observed_at > new Date(to + 'T23:59:59').toISOString()) return false;
			if (activeTags.size) {
				const own = new Set((o.observation_tags ?? []).map((x) => x.tag_id));
				// Every selected tag must be present: filters narrow, never widen.
				for (const id of activeTags) if (!own.has(id)) return false;
			}
			if (taxonQuery.trim()) {
				const q = taxonQuery.toLowerCase();
				const taxon = o.plantings?.taxa;
				const hit =
					scientificName(taxon).toLowerCase().includes(q) ||
					(taxon?.name_fi ?? '').toLowerCase().includes(q) ||
					(o.plantings?.accession_code ?? '').toLowerCase().includes(q);
				if (!hit) return false;
			}
			return true;
		})
	);
</script>

<svelte:head><title>{t.reports.observations} — {t.app.name}</title></svelte:head>

<div class="section">
	<p class="eyebrow no-print"><a href="/raportit">{t.reports.title}</a></p>

	<div class="head">
		<h1>{t.reports.observations}</h1>
		<button class="btn btn-sm no-print" type="button" onclick={() => window.print()}>
			{t.common.print}
		</button>
	</div>

	<div class="filters no-print">
		<div class="field">
			<label for="from">{t.reports.from}</label>
			<input id="from" type="date" bind:value={from} />
		</div>
		<div class="field">
			<label for="to">{t.reports.to}</label>
			<input id="to" type="date" bind:value={to} />
		</div>
		<div class="field">
			<label for="kind">{t.observation.kind}</label>
			<select id="kind" bind:value={kind}>
				<option value="">{t.common.all}</option>
				{#each Object.entries(t.enums.kind) as [value, label] (value)}
					<option {value}>{label}</option>
				{/each}
			</select>
		</div>
		<div class="field">
			<label for="taxon-q">{t.taxon.one}</label>
			<input id="taxon-q" type="search" bind:value={taxonQuery} placeholder="Laji tai tunnus" />
		</div>
	</div>

	<div class="tag-filter no-print">
		{#each tags as tag (tag.id)}
			<TagChip {tag} interactive pressed={activeTags.has(tag.id)} onclick={() => toggleTag(tag.id)} />
		{/each}
	</div>

	<p class="data muted count">{t.observation.count(filtered.length)}</p>

	{#if loading}
		<p class="muted">{t.common.loading}</p>
	{:else if !filtered.length}
		<p class="empty">{t.reports.noData}</p>
	{:else}
		<div class="stack">
			{#each filtered as observation (observation.id)}
				<ObservationCard
					{observation}
					showTarget
					ondeleted={(id) => {
						observations = observations.filter((row) => row.id !== id);
					}}
				/>
			{/each}
		</div>
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

	.filters {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0 0.75rem;
	}

	.tag-filter {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.85rem;
	}

	.count {
		margin: 0 0 0.85rem;
	}
</style>
